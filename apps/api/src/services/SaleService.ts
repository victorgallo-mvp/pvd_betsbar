import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { broadcast } from '../ws/broadcast.js'
import { PrintService } from './PrintService.js'
import { Diag } from './DiagService.js'
import { ctx } from '../lib/reqContext.js'
import { readConfig } from '../appConfig.js'

// Operador que está agindo neste aparelho: corpo da requisição ou cabeçalho X-Operator-Id
async function actingOperator(bodyOperatorId?: string | null) {
  const id = bodyOperatorId || ctx()?.operatorId || null
  if (!id) return null
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true } })
  return u ?? null
}

// --- Prisma payload types ---

type TableRow = Prisma.TableGetPayload<Record<string, never>>

type SaleRow = Prisma.SaleGetPayload<{
  include: {
    operator: true
    table: true
    items: { include: { product: true; addedBy: { select: { id: true; name: true } } } }
    payments: true
    guests: true
  }
}>

// --- DTO mappers ---

function tableToDTO(t: TableRow, customerName: string | null = null) {
  return {
    id: t.id,
    number: t.number,
    status: t.status,
    openedAt: t.openedAt?.toISOString() ?? null,
    peopleCount: t.peopleCount,
    customerName,
  }
}

function saleToDTO(s: SaleRow) {
  return {
    id: s.id,
    type: s.type,
    tableId: s.tableId,
    tableNumber: s.table?.number ?? null,
    peopleCount: s.peopleCount,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
    operatorId: s.operatorId,
    operatorName: s.operator.name,
    status: s.status,
    subtotal: Number(s.subtotal),
    discount: Number(s.discount),
    surcharge: Number(s.surcharge),
    total: Number(s.total),
    perPersonAmount: s.perPersonAmount != null ? Number(s.perPersonAmount) : null,
    customerName: s.customerName,
    customerAddress: s.customerAddress,
    items: s.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
      subtotal: Number(i.unitPrice) * i.qty,
      sentToProduction: i.sentToProduction,
      cancelled: i.cancelled,
      sendToKitchen: i.product.sendToKitchen,
      sendToCounter: i.product.sendToCounter,
      notes: i.notes,
      guestId: i.guestId ?? null,
      addedById: i.addedById ?? null,
      addedByName: i.addedBy?.name ?? null,
    })),
    payments: s.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: Number(p.amount),
      paidAt: p.paidAt.toISOString(),
      guestId: p.guestId ?? null,
    })),
    guests: [...s.guests]
      .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime())
      .map((g) => ({ id: g.id, name: g.name, position: g.position })),
  }
}

const saleInclude = {
  operator: true,
  table: true,
  items: { include: { product: true, addedBy: { select: { id: true, name: true } } } },
  payments: true,
  guests: true,
} as const

// Garante que a pessoa existe e pertence à venda (null = mesa)
async function assertGuest(saleId: string, guestId: string | null | undefined) {
  if (!guestId) return null
  const g = await prisma.saleGuest.findUnique({ where: { id: guestId } })
  if (!g || g.saleId !== saleId) throw new Error('Pessoa não encontrada nesta mesa')
  return g
}

// Ticket de pedido no balcão SEM mexer no agente: sai como job tipo 'receipt',
// que o executável imprime com o modelo de comprovante. O que dá para controlar
// pelo payload: a linha logo abaixo de "Cliente:" (campo customerAddress) vira o
// aviso "*** PEDIDO BALCAO - NAO E CONTA ***"; os itens são só os de balcão.
// Título "Comprovante", TOTAL e "Obrigado pela visita!" são fixos no modelo.
export function buildCounterTicket(input: {
  saleId: string
  tableNumber: number | null
  customerName: string | null
  saleType: string
  operatorName: string
  items: { qty: number; name: string; unitPrice: number; guest: string | null }[]
}) {
  const label = input.customerName ?? (input.tableNumber ? `Mesa ${input.tableNumber}` : input.saleType === 'counter' ? 'Balcao' : 'Delivery')
  const items = input.items.map((i) => ({
    name: i.guest ? `${i.name} (${i.guest})` : i.name,
    qty: i.qty, unitPrice: i.unitPrice, subtotal: i.unitPrice * i.qty, guest: i.guest,
  }))
  const total = items.reduce((s, i) => s + i.subtotal, 0)
  return {
    saleId: input.saleId,
    saleType: input.saleType,
    date: new Date().toISOString(),
    operatorName: input.operatorName,
    tableNumber: input.tableNumber,
    customerName: label,
    customerAddress: '*** PEDIDO BALCAO - NAO E CONTA ***',
    items,
    subtotal: total, discount: 0, total,
    payments: [] as { method: string; amount: number }[],
    troco: 0,
    counterTicket: true,
  }
}

// --- Service ---

export const SaleService = {
  // Tables
  async getTables() {
    const rows = await prisma.table.findMany({
      orderBy: { number: 'asc' },
      include: {
        sales: {
          where: { status: { in: ['open', 'awaiting_payment'] } },
          select: { customerName: true },
          orderBy: { openedAt: 'desc' as const },
          take: 1,
        },
      },
    })
    return rows.map((t) => tableToDTO(t, t.sales[0]?.customerName ?? null))
  },

  // Categories
  async getCategories() {
    return prisma.category.findMany({
      where: { active: true },
      select: { id: true, name: true, color: true, icon: true, displayOrder: true, active: true },
      orderBy: { displayOrder: 'asc' },
    })
  },

  // Products — Favoritos = isFavorite flag, others by categoryId
  async getProducts(categoryId?: string) {
    const where =
      categoryId === 'cat_favoritos'
        ? { active: true, isFavorite: true }
        : categoryId
          ? { active: true, categoryId }
          : { active: true }

    const rows = await prisma.product.findMany({
      where,
      select: { id: true, categoryId: true, name: true, price: true, isFavorite: true, sendToKitchen: true, sendToCounter: true, active: true },
      orderBy: { name: 'asc' },
    })
    return rows.map((p) => ({ ...p, price: Number(p.price) }))
  },

  // Open a new sale
  async openSale(input: {
    type: string
    tableId?: string
    operatorId: string
    customerName?: string
    customerAddress?: string
    guests?: string[]
  }) {
    // Idempotência: se a mesa já tem venda ativa, retorna ela em vez de duplicar.
    // (Evita vendas órfãs quando o cliente tem estado desatualizado ou re-tenta após timeout.)
    if (input.tableId) {
      const existing = await prisma.sale.findFirst({
        where: { tableId: input.tableId, status: { in: ['open', 'awaiting_payment'] } },
        include: saleInclude,
        orderBy: { openedAt: 'desc' },
      })
      if (existing) {
        Diag.log({
          type: 'conflict.open_existing',
          saleId: existing.id,
          tableNumber: existing.table?.number ?? null,
          data: {
            typedName: input.customerName ?? null,
            existingName: existing.customerName,
            existingItems: existing.items.length,
            existingOpenedAt: existing.openedAt.toISOString(),
            existingOperatorId: existing.operatorId,
          },
        })
        return saleToDTO(existing)
      }
    }

    let table: TableRow | null = null
    const sale = await prisma.$transaction(async (tx) => {
      const s = await tx.sale.create({
        data: {
          type: input.type,
          tableId: input.tableId ?? null,
          operatorId: input.operatorId,
          customerName: input.customerName ?? null,
          customerAddress: input.customerAddress ?? null,
          status: 'open',
          ...(input.guests && input.guests.length > 0 && {
            guests: { create: input.guests.map((name, position) => ({ name, position })) },
          }),
        },
        include: saleInclude,
      })
      if (input.tableId) {
        table = await tx.table.update({
          where: { id: input.tableId },
          data: { status: 'open', openedAt: new Date() },
        })
      }
      return s
    })

    if (table) {
      broadcast({ event: 'table_update', table: tableToDTO(table, input.customerName ?? null) })
    }

    Diag.log({
      type: 'sale.opened',
      saleId: sale.id,
      tableNumber: sale.table?.number ?? null,
      data: { saleType: input.type, customerName: input.customerName ?? null, operatorId: input.operatorId, guests: input.guests ?? [] },
    })
    return saleToDTO(sale)
  },

  // Get single sale
  async getSale(saleId: string) {
    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: saleInclude,
    })
    return saleToDTO(sale)
  },

  // Active sale for a table (open or awaiting_payment)
  async getActiveSaleForTable(tableId: string) {
    const sale = await prisma.sale.findFirst({
      where: { tableId, status: { in: ['open', 'awaiting_payment'] } },
      include: saleInclude,
      orderBy: { openedAt: 'desc' },
    })
    if (!sale) {
      // Mesa marcada como ocupada sem venda ativa = grade do aparelho desatualizada ou mesa órfã
      const table = await prisma.table.findUnique({ where: { id: tableId } })
      Diag.log({
        type: 'conflict.active_sale_missing',
        tableNumber: table?.number ?? null,
        data: { tableId, tableStatus: table?.status ?? 'inexistente' },
      })
    }
    return sale ? saleToDTO(sale) : null
  },

  // Add item — merges if same product is not yet sent to production
  async addItem(saleId: string, input: { productId: string; qty: number; guestId?: string | null; operatorId?: string }) {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: input.productId } })
    const guest = await assertGuest(saleId, input.guestId)
    const guestId = guest?.id ?? null
    const actor = await actingOperator(input.operatorId)

    // Só junta com item pendente da MESMA pessoa (ou da mesa)
    const existing = await prisma.saleItem.findFirst({
      where: { saleId, productId: input.productId, sentToProduction: false, cancelled: false, guestId },
    })

    let itemId: string
    if (existing) {
      await prisma.saleItem.update({
        where: { id: existing.id },
        data: { qty: existing.qty + input.qty },
      })
      itemId = existing.id
    } else {
      const created = await prisma.saleItem.create({
        data: { saleId, productId: input.productId, qty: input.qty, unitPrice: product.price, guestId, addedById: actor?.id ?? null },
      })
      itemId = created.id
    }

    const result = await SaleService.recalcAndGet(saleId)
    Diag.log({
      type: 'sale.item_added',
      saleId,
      tableNumber: result.tableNumber,
      data: {
        itemId, productId: input.productId, productName: product.name, qty: input.qty,
        merged: !!existing, qtyBefore: existing?.qty ?? 0, qtyAfter: (existing?.qty ?? 0) + input.qty,
        saleStatus: result.status, customerName: result.customerName,
        guestId, guestName: guest?.name ?? null, addedById: actor?.id ?? null,
      },
    })
    if (result.status !== 'open' && result.status !== 'awaiting_payment') {
      Diag.log({ type: 'conflict.item_on_closed_sale', saleId, tableNumber: result.tableNumber, data: { itemId, status: result.status } })
    }
    return result
  },

  // Move item para outra pessoa (ou de volta para a mesa, guestId = null).
  // Permitido mesmo depois de lançado: não altera quantidade nem cozinha.
  async moveItem(saleId: string, itemId: string, guestId: string | null) {
    const item = await prisma.saleItem.findUniqueOrThrow({ where: { id: itemId }, include: { product: true, guest: true } })
    if (item.saleId !== saleId) throw new Error('Item não pertence a esta venda')
    if (item.cancelled) throw new Error('Item cancelado')
    const guest = await assertGuest(saleId, guestId)

    await prisma.saleItem.update({ where: { id: itemId }, data: { guestId: guest?.id ?? null } })

    const result = await SaleService.getSale(saleId)
    Diag.log({
      type: 'sale.item_moved',
      saleId,
      tableNumber: result.tableNumber,
      data: {
        itemId, productId: item.productId, productName: item.product.name, qty: item.qty, sent: item.sentToProduction,
        fromGuestId: item.guestId, fromGuestName: item.guest?.name ?? null,
        toGuestId: guest?.id ?? null, toGuestName: guest?.name ?? null,
      },
    })
    return result
  },

  // Pessoas da mesa
  async addGuest(saleId: string, name: string) {
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId }, include: { guests: true, table: true } })
    if (sale.status !== 'open' && sale.status !== 'awaiting_payment') throw new Error('Venda já encerrada')
    if (sale.guests.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`Já existe "${name}" nesta mesa`)
    }
    const position = sale.guests.reduce((m, g) => Math.max(m, g.position), -1) + 1
    const guest = await prisma.saleGuest.create({ data: { saleId, name, position } })
    Diag.log({ type: 'sale.guest_added', saleId, tableNumber: sale.table?.number ?? null, data: { guestId: guest.id, name, position, guestsAfter: sale.guests.length + 1 } })
    return SaleService.getSale(saleId)
  },

  async renameGuest(saleId: string, guestId: string, name: string) {
    const guest = await assertGuest(saleId, guestId)
    if (!guest) throw new Error('Pessoa não encontrada')
    await prisma.saleGuest.update({ where: { id: guestId }, data: { name } })
    const result = await SaleService.getSale(saleId)
    Diag.log({ type: 'sale.guest_renamed', saleId, tableNumber: result.tableNumber, data: { guestId, from: guest.name, to: name } })
    return result
  },

  // Remove a pessoa; itens e pagamentos dela voltam para a mesa (SetNull no banco)
  async removeGuest(saleId: string, guestId: string) {
    const guest = await assertGuest(saleId, guestId)
    if (!guest) throw new Error('Pessoa não encontrada')
    const [items, payments] = await Promise.all([
      prisma.saleItem.count({ where: { guestId, cancelled: false } }),
      prisma.payment.count({ where: { guestId } }),
    ])
    await prisma.saleGuest.delete({ where: { id: guestId } })
    const result = await SaleService.getSale(saleId)
    Diag.log({ type: 'sale.guest_removed', saleId, tableNumber: result.tableNumber, data: { guestId, name: guest.name, itemsReturnedToTable: items, paymentsReturnedToTable: payments } })
    return result
  },

  // Remove 1 unit from a pending item (or remove item if qty would reach 0)
  async removeItem(saleId: string, itemId: string) {
    const item = await prisma.saleItem.findUniqueOrThrow({ where: { id: itemId } })

    if (item.sentToProduction) {
      throw new Error('Item já enviado pra produção — use cancelamento')
    }

    if (item.qty > 1) {
      await prisma.saleItem.update({ where: { id: itemId }, data: { qty: item.qty - 1 } })
    } else {
      await prisma.saleItem.delete({ where: { id: itemId } })
    }

    const result = await SaleService.recalcAndGet(saleId)
    Diag.log({
      type: 'sale.item_removed',
      saleId,
      tableNumber: result.tableNumber,
      data: { itemId, productId: item.productId, qtyBefore: item.qty, deleted: item.qty <= 1 },
    })
    return result
  },

  // Mark pending items as sent to production
  async concludeItems(saleId: string) {
    await prisma.saleItem.updateMany({
      where: { saleId, sentToProduction: false, cancelled: false },
      data: { sentToProduction: true },
    })
    return SaleService.recalcAndGet(saleId)
  },

  // Request bill — imprime o extrato atual (itens + total + pagamentos já
  // feitos). Não trava mais a mesa em awaiting_payment: ela continua aberta
  // pra outros lançarem pedido, e só fecha de fato quando os pagamentos
  // somados cobrirem o total (ver registerPayment). Pode ser chamado quantas
  // vezes forem necessárias ao longo do atendimento.
  async requestBill(saleId: string, input: { peopleCount: number; guestId?: string | null }) {
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })
    const guest = await assertGuest(saleId, input.guestId)
    const perPersonAmount = Number(sale.total) / input.peopleCount

    // Conta de uma pessoa não mexe na divisão "por N" da mesa
    if (!guest) {
      await prisma.sale.update({
        where: { id: saleId },
        data: { peopleCount: input.peopleCount, perPersonAmount },
      })
    }

    // Auto-print bill receipt (fire-and-forget — print failure must not block the flow)
    PrintService.createBillJob(saleId, guest?.id ?? null)
      .then((job) => {
        Diag.log({ type: 'sale.bill_requested', saleId, data: { jobId: job.id, peopleCount: input.peopleCount, total: Number(sale.total), status: sale.status, guestId: guest?.id ?? null, guestName: guest?.name ?? null } })
      })
      .catch((err) => {
        console.error('[Print] createBillJob falhou:', err)
        Diag.log({ type: 'sale.bill_job_failed', saleId, data: { error: (err as Error).message } })
      })

    return SaleService.getSale(saleId)
  },

  // Register a payment — closes sale + frees table when total is covered
  async registerPayment(saleId: string, input: { method: string; amount: number; guestId?: string | null }) {
    const guest = await assertGuest(saleId, input.guestId)
    let diag: Record<string, unknown> = {}
    const freedTable = await prisma.$transaction(async (tx) => {
      // Total lido DENTRO da transação — evita fechar a venda com total desatualizado
      const sale = await tx.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: { payments: true, table: true },
      })

      await tx.payment.create({
        data: { saleId, method: input.method, amount: input.amount, guestId: guest?.id ?? null },
      })

      const totalPaid =
        sale.payments.reduce((sum, p) => sum + Number(p.amount), 0) + input.amount

      diag = {
        tableNumber: sale.table?.number ?? null, statusBefore: sale.status, method: input.method,
        amount: input.amount, paidBefore: totalPaid - input.amount, total: Number(sale.total),
        closes: totalPaid >= Number(sale.total), guestId: guest?.id ?? null, guestName: guest?.name ?? null,
      }

      if (totalPaid < Number(sale.total)) return null

      await tx.sale.update({
        where: { id: saleId },
        data: { status: 'paid', closedAt: new Date() },
      })

      if (!sale.tableId) return null
      return tx.table.update({
        where: { id: sale.tableId },
        data: { status: 'free', openedAt: null, peopleCount: null },
      })
    })

    if (freedTable) {
      broadcast({ event: 'table_update', table: tableToDTO(freedTable) })
    }

    Diag.log({ type: 'sale.payment', saleId, tableNumber: (diag.tableNumber as number | null) ?? null, data: diag })
    if (diag.statusBefore === 'paid' || diag.statusBefore === 'cancelled') {
      Diag.log({ type: 'conflict.payment_on_closed_sale', saleId, tableNumber: (diag.tableNumber as number | null) ?? null, data: diag })
    }
    return SaleService.getSale(saleId)
  },

  // List paid table sales for a given date (YYYY-MM-DD, BRT)
  async listSalesByDate(date: string) {
    const from = new Date(date + 'T00:00:00-03:00')
    const to   = new Date(date + 'T23:59:59.999-03:00')

    const sales = await prisma.sale.findMany({
      where: { type: 'table', status: 'paid', closedAt: { gte: from, lte: to } },
      include: saleInclude,
      orderBy: { closedAt: 'asc' },
    })

    return sales.map(saleToDTO)
  },

  // Update mutable sale fields (customerName, customerAddress)
  async updateSale(saleId: string, input: { customerName?: string; customerAddress?: string }) {
    const before = await prisma.sale.findUnique({ where: { id: saleId }, include: { table: true } })
    if (before && input.customerName !== undefined && (input.customerName || null) !== before.customerName) {
      Diag.log({
        type: 'sale.renamed',
        saleId,
        tableNumber: before.table?.number ?? null,
        data: { from: before.customerName, to: input.customerName || null },
      })
    }
    await prisma.sale.update({
      where: { id: saleId },
      data: {
        ...(input.customerName !== undefined && { customerName: input.customerName || null }),
        ...(input.customerAddress !== undefined && { customerAddress: input.customerAddress || null }),
      },
    })
    return SaleService.getSale(saleId)
  },

  // Cancel sale — mark cancelled + free the table
  async cancelSale(saleId: string) {
    let diag: Record<string, unknown> = {}
    const freedTable = await prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUniqueOrThrow({ where: { id: saleId }, include: { table: true, items: true, payments: true } })
      diag = {
        tableNumber: sale.table?.number ?? null, statusBefore: sale.status, items: sale.items.filter((i) => !i.cancelled).length,
        total: Number(sale.total), payments: sale.payments.length, customerName: sale.customerName,
      }

      await tx.sale.update({
        where: { id: saleId },
        data: { status: 'cancelled', closedAt: new Date() },
      })

      if (!sale.tableId) return null
      return tx.table.update({
        where: { id: sale.tableId },
        data: { status: 'free', openedAt: null, peopleCount: null },
      })
    })

    if (freedTable) {
      broadcast({ event: 'table_update', table: tableToDTO(freedTable) })
    }
    Diag.log({ type: 'sale.cancelled', saleId, tableNumber: (diag.tableNumber as number | null) ?? null, data: diag })
  },

  // Cancel a sent item — marks cancelled + queues kitchen cancel notice
  async cancelItem(saleId: string, itemId: string, operatorId?: string) {
    const item = await prisma.saleItem.findUniqueOrThrow({
      where: { id: itemId },
      include: {
        product: true,
        guest: true,
        sale: { include: { operator: true, table: true } },
      },
    })
    const actor = await actingOperator(operatorId)

    await prisma.saleItem.update({ where: { id: itemId }, data: { cancelled: true, cancelledById: actor?.id ?? null } })

    Diag.log({
      type: 'sale.item_cancelled',
      saleId,
      tableNumber: item.sale.table?.number ?? null,
      data: {
        itemId, productId: item.productId, productName: item.product.name, qty: item.qty,
        sentToProduction: item.sentToProduction, kitchen: item.product.sendToKitchen,
        itemAgeMs: Date.now() - item.createdAt.getTime(), customerName: item.sale.customerName,
        addedById: item.addedById, cancelledById: actor?.id ?? null,
      },
    })

    // Aviso de cancelamento no balcão (mesmo modelo do ticket de pedido: job tipo comprovante)
    if (item.sentToProduction && item.product.sendToCounter && readConfig().features.counterTickets) {
      const s = item.sale
      await prisma.printJob.create({
        data: {
          saleId,
          type: 'receipt',
          status: 'pending',
          triggerEvent: 'counter_cancel',
          payload: JSON.stringify(buildCounterTicket({
            saleId, tableNumber: s.table?.number ?? null, customerName: s.customerName, saleType: s.type,
            operatorName: actor?.name ?? s.operator.name,
            items: [{ qty: item.qty, name: `[CANCELAR] ${item.product.name}`, unitPrice: Number(item.unitPrice), guest: item.guest?.name ?? null }],
          })),
        },
      })
    }

    if (item.sentToProduction && item.product.sendToKitchen) {
      const s = item.sale
      await prisma.printJob.create({
        data: {
          saleId,
          type: 'kitchen',
          status: 'pending',
          triggerEvent: 'item_cancelled',
          payload: JSON.stringify({
            tableNumber: s.table?.number ?? null,
            customerName: s.customerName ?? null,
            saleType: s.type,
            operatorName: s.operator.name,
            printedAt: new Date().toISOString(),
            items: [{ qty: item.qty, name: `[CANCELAR] ${item.product.name}`, notes: null, guest: item.guest?.name ?? null }],
          }),
        },
      })
    }

    return SaleService.recalcAndGet(saleId)
  },

  // Recalc totals and return updated sale
  async recalcAndGet(saleId: string) {
    const items = await prisma.saleItem.findMany({
      where: { saleId, cancelled: false },
    })
    const subtotal = items.reduce((sum, i) => sum + Number(i.unitPrice) * i.qty, 0)

    await prisma.sale.update({
      where: { id: saleId },
      data: { subtotal, total: subtotal },
    })

    return SaleService.getSale(saleId)
  },
}
