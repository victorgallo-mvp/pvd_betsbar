import { PrismaClient, type Prisma } from '@prisma/client'
import { broadcast } from '../ws/broadcast.js'
import { PrintService } from './PrintService.js'

const prisma = new PrismaClient()

// --- Prisma payload types ---

type TableRow = Prisma.TableGetPayload<Record<string, never>>

type SaleRow = Prisma.SaleGetPayload<{
  include: {
    operator: true
    table: true
    items: { include: { product: true } }
    payments: true
  }
}>

// --- DTO mappers ---

function tableToDTO(t: TableRow) {
  return {
    id: t.id,
    number: t.number,
    status: t.status,
    openedAt: t.openedAt?.toISOString() ?? null,
    peopleCount: t.peopleCount,
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
      notes: i.notes,
    })),
    payments: s.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amount: Number(p.amount),
      paidAt: p.paidAt.toISOString(),
    })),
  }
}

const saleInclude = {
  operator: true,
  table: true,
  items: { include: { product: true } },
  payments: true,
} as const

// --- Service ---

export const SaleService = {
  // Tables
  async getTables() {
    const rows = await prisma.table.findMany({ orderBy: { number: 'asc' } })
    return rows.map(tableToDTO)
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
      select: { id: true, categoryId: true, name: true, price: true, isFavorite: true, active: true },
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
  }) {
    const sale = await prisma.sale.create({
      data: {
        type: input.type,
        tableId: input.tableId ?? null,
        operatorId: input.operatorId,
        customerName: input.customerName ?? null,
        customerAddress: input.customerAddress ?? null,
        status: 'open',
      },
      include: saleInclude,
    })

    if (input.tableId) {
      const table = await prisma.table.update({
        where: { id: input.tableId },
        data: { status: 'open', openedAt: new Date() },
      })
      broadcast({ event: 'table_update', table: tableToDTO(table) })
    }

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
    return sale ? saleToDTO(sale) : null
  },

  // Add item — merges if same product is not yet sent to production
  async addItem(saleId: string, input: { productId: string; qty: number }) {
    const product = await prisma.product.findUniqueOrThrow({ where: { id: input.productId } })

    const existing = await prisma.saleItem.findFirst({
      where: { saleId, productId: input.productId, sentToProduction: false, cancelled: false },
    })

    if (existing) {
      await prisma.saleItem.update({
        where: { id: existing.id },
        data: { qty: existing.qty + input.qty },
      })
    } else {
      await prisma.saleItem.create({
        data: { saleId, productId: input.productId, qty: input.qty, unitPrice: product.price },
      })
    }

    return SaleService.recalcAndGet(saleId)
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

    return SaleService.recalcAndGet(saleId)
  },

  // Mark pending items as sent to production
  async concludeItems(saleId: string) {
    await prisma.saleItem.updateMany({
      where: { saleId, sentToProduction: false, cancelled: false },
      data: { sentToProduction: true },
    })
    return SaleService.recalcAndGet(saleId)
  },

  // Request bill — compute perPersonAmount, put sale + table into awaiting_payment
  async requestBill(saleId: string, input: { peopleCount: number }) {
    const sale = await prisma.sale.findUniqueOrThrow({ where: { id: saleId } })
    const perPersonAmount = Number(sale.total) / input.peopleCount

    await prisma.sale.update({
      where: { id: saleId },
      data: {
        status: 'awaiting_payment',
        peopleCount: input.peopleCount,
        perPersonAmount,
      },
    })

    if (sale.tableId) {
      const table = await prisma.table.update({
        where: { id: sale.tableId },
        data: { status: 'awaiting_payment', peopleCount: input.peopleCount },
      })
      broadcast({ event: 'table_update', table: tableToDTO(table) })
    }

    // Auto-print bill receipt (fire-and-forget — print failure must not block the flow)
    PrintService.createBillJob(saleId).catch((err) =>
      console.error('[Print] createBillJob falhou:', err),
    )

    return SaleService.getSale(saleId)
  },

  // Register a payment — closes sale + frees table when total is covered
  async registerPayment(saleId: string, input: { method: string; amount: number }) {
    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: { payments: true },
    })

    await prisma.payment.create({
      data: { saleId, method: input.method, amount: input.amount },
    })

    const totalPaid =
      sale.payments.reduce((sum, p) => sum + Number(p.amount), 0) + input.amount

    if (totalPaid >= Number(sale.total)) {
      await prisma.sale.update({
        where: { id: saleId },
        data: { status: 'paid', closedAt: new Date() },
      })

      if (sale.tableId) {
        const table = await prisma.table.update({
          where: { id: sale.tableId },
          data: { status: 'free', openedAt: null, peopleCount: null },
        })
        broadcast({ event: 'table_update', table: tableToDTO(table) })
      }
    }

    return SaleService.getSale(saleId)
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
