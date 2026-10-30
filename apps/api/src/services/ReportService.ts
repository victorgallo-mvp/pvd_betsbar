import { prisma } from '../lib/prisma.js'


export const ReportService = {
  async getSummary(from: Date, to: Date) {
    const sales = await prisma.sale.findMany({
      where: { status: 'paid', closedAt: { gte: from, lte: to } },
      include: { payments: true },
    })

    const total = sales.reduce((s, sale) => s + Number(sale.total), 0)
    const count = sales.length
    const avgTicket = count > 0 ? total / count : 0

    const byType = sales.reduce(
      (acc, sale) => {
        const t = sale.type
        if (!acc[t]) acc[t] = { type: t, count: 0, total: 0 }
        acc[t]!.count++
        acc[t]!.total += Number(sale.total)
        return acc
      },
      {} as Record<string, { type: string; count: number; total: number }>,
    )

    return { count, total, avgTicket, byType: Object.values(byType) }
  },

  async getByPaymentMethod(from: Date, to: Date) {
    const payments = await prisma.payment.findMany({
      where: { sale: { status: 'paid', closedAt: { gte: from, lte: to } } },
    })

    const grouped: Record<string, { method: string; count: number; total: number }> = {}
    for (const p of payments) {
      if (!grouped[p.method]) grouped[p.method] = { method: p.method, count: 0, total: 0 }
      grouped[p.method]!.count++
      grouped[p.method]!.total += Number(p.amount)
    }

    const rows = Object.values(grouped).sort((a, b) => b.total - a.total)
    const grandTotal = rows.reduce((s, r) => s + r.total, 0)
    return rows.map((r) => ({ ...r, pct: grandTotal > 0 ? r.total / grandTotal : 0 }))
  },

  async getByProduct(from: Date, to: Date) {
    const items = await prisma.saleItem.findMany({
      where: {
        cancelled: false,
        sale: { status: 'paid', closedAt: { gte: from, lte: to } },
      },
      include: { product: { select: { name: true } } },
    })

    const grouped: Record<string, { productId: string; name: string; qty: number; revenue: number }> = {}
    for (const item of items) {
      if (!grouped[item.productId]) {
        grouped[item.productId] = { productId: item.productId, name: item.product.name, qty: 0, revenue: 0 }
      }
      grouped[item.productId]!.qty += item.qty
      grouped[item.productId]!.revenue += Number(item.unitPrice) * item.qty
    }

    const rows = Object.values(grouped).sort((a, b) => b.revenue - a.revenue)
    const grandTotal = rows.reduce((s, r) => s + r.revenue, 0)
    return rows.map((r) => ({ ...r, pct: grandTotal > 0 ? r.revenue / grandTotal : 0 }))
  },

  async getByOperator(from: Date, to: Date) {
    const sales = await prisma.sale.findMany({
      where: { status: 'paid', closedAt: { gte: from, lte: to } },
      include: { operator: { select: { name: true } } },
    })

    const grouped: Record<string, { operatorId: string; name: string; count: number; total: number }> = {}
    for (const sale of sales) {
      if (!grouped[sale.operatorId]) {
        grouped[sale.operatorId] = { operatorId: sale.operatorId, name: sale.operator.name, count: 0, total: 0 }
      }
      grouped[sale.operatorId]!.count++
      grouped[sale.operatorId]!.total += Number(sale.total)
    }

    return Object.values(grouped).sort((a, b) => b.total - a.total)
  },

  // Lançamentos por garçom: cada item conta para quem o lançou (addedById).
  // Itens antigos sem o campo caem em quem abriu a mesa (fallback), contados à parte.
  async getByWaiter(from: Date, to: Date) {
    const sales = await prisma.sale.findMany({
      where: { status: 'paid', closedAt: { gte: from, lte: to } },
      include: {
        operator: { select: { name: true } },
        items: { include: { addedBy: { select: { name: true } } } },
      },
    })
    type Row = { operatorId: string; name: string; items: number; total: number; cancelledItems: number; cancelledTotal: number; tablesOpened: number; fallbackItems: number }
    const rows: Record<string, Row> = {}
    const get = (id: string, name: string) => (rows[id] ??= { operatorId: id, name, items: 0, total: 0, cancelledItems: 0, cancelledTotal: 0, tablesOpened: 0, fallbackItems: 0 })
    for (const sale of sales) {
      get(sale.operatorId, sale.operator.name).tablesOpened++
      for (const it of sale.items) {
        const id = it.addedById ?? sale.operatorId
        const r = get(id, it.addedBy?.name ?? sale.operator.name)
        const val = Number(it.unitPrice) * it.qty
        if (!it.addedById) r.fallbackItems += it.qty
        if (it.cancelled) { r.cancelledItems += it.qty; r.cancelledTotal += val; continue }
        r.items += it.qty
        r.total += val
      }
    }
    return Object.values(rows).sort((a, b) => b.total - a.total)
  },

  // Preenche addedById dos itens antigos a partir do diário (sale.item_added traz
  // itemId e o operador do aparelho). Idempotente: só mexe em itens sem o campo.
  async backfillAddedBy() {
    const events = await prisma.diagEvent.findMany({
      where: { type: 'sale.item_added', operatorId: { not: null } },
      select: { operatorId: true, data: true },
      orderBy: { createdAt: 'asc' },
    })
    const byItem = new Map<string, string>()
    for (const e of events) {
      try {
        const itemId = (JSON.parse(e.data ?? '{}') as { itemId?: string }).itemId
        if (itemId && !byItem.has(itemId)) byItem.set(itemId, e.operatorId!)
      } catch { /* ignora evento malformado */ }
    }
    const users = new Set((await prisma.user.findMany({ select: { id: true } })).map((u) => u.id))
    let updated = 0
    for (const [itemId, operatorId] of byItem) {
      if (!users.has(operatorId)) continue
      const r = await prisma.saleItem.updateMany({ where: { id: itemId, addedById: null }, data: { addedById: operatorId } })
      updated += r.count
    }
    return { events: events.length, itemsInDiary: byItem.size, updated }
  },
}
