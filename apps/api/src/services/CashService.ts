import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const CashService = {
  // Single active session for the whole establishment (not per-operator)
  async getActiveSession() {
    const session = await prisma.cashSession.findFirst({
      where: { closedAt: null },
      include: { operator: true, withdrawals: { orderBy: { createdAt: 'desc' } } },
      orderBy: { openedAt: 'desc' },
    })
    return session ? sessionToDTO(session) : null
  },

  async openSession(operatorId: string, openingFund: number) {
    const existing = await prisma.cashSession.findFirst({ where: { closedAt: null } })
    if (existing) throw new Error('Já existe uma sessão de caixa aberta.')

    const session = await prisma.cashSession.create({
      data: { operatorId, openingFund },
      include: { operator: true, withdrawals: true },
    })
    return sessionToDTO(session)
  },

  async withdraw(sessionId: string, amount: number, reason: string) {
    const session = await prisma.cashSession.findUniqueOrThrow({ where: { id: sessionId } })
    if (session.closedAt) throw new Error('Sessão já encerrada.')

    return prisma.withdrawal.create({
      data: { cashSessionId: sessionId, amount, reason },
    })
  },

  async getReport(sessionId: string) {
    const session = await prisma.cashSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { operator: true, withdrawals: { orderBy: { createdAt: 'asc' } } },
    })

    const endTime = session.closedAt ?? new Date()

    // All payments received during this session window
    const payments = await prisma.payment.findMany({
      where: { paidAt: { gte: session.openedAt, lte: endTime } },
    })

    // Count of distinct paid sales during this window
    const paidSaleIds = [...new Set(payments.map((p) => p.saleId))]

    // Group payments by method
    const byMethod: Record<string, { method: string; count: number; total: number }> = {}
    for (const p of payments) {
      if (!byMethod[p.method]) byMethod[p.method] = { method: p.method, count: 0, total: 0 }
      byMethod[p.method]!.count++
      byMethod[p.method]!.total += Number(p.amount)
    }

    const salesByMethod = Object.values(byMethod).sort((a, b) => b.total - a.total)
    const totalSales = payments.reduce((s, p) => s + Number(p.amount), 0)
    const cashSales = payments
      .filter((p) => p.method === 'cash')
      .reduce((s, p) => s + Number(p.amount), 0)
    const totalWithdrawals = session.withdrawals.reduce((s, w) => s + Number(w.amount), 0)
    const expectedCash = Number(session.openingFund) + cashSales - totalWithdrawals

    return {
      session: sessionToDTO(session),
      salesByMethod,
      paidSalesCount: paidSaleIds.length,
      totalSales,
      cashSales,
      totalWithdrawals,
      expectedCash,
      withdrawals: session.withdrawals.map((w) => ({
        id: w.id,
        amount: Number(w.amount),
        reason: w.reason,
        createdAt: w.createdAt.toISOString(),
      })),
    }
  },

  async closeSession(sessionId: string) {
    const report = await CashService.getReport(sessionId)

    await prisma.cashSession.update({
      where: { id: sessionId },
      data: { closedAt: new Date(), total: report.totalSales },
    })

    return CashService.getReport(sessionId) // re-fetch with closedAt set
  },
}

type SessionRow = {
  id: string
  operatorId: string
  operator: { name: string }
  openedAt: Date
  closedAt: Date | null
  openingFund: import('@prisma/client').Prisma.Decimal
  total: import('@prisma/client').Prisma.Decimal | null
  withdrawals: { id: string; amount: import('@prisma/client').Prisma.Decimal; reason: string; createdAt: Date }[]
}

function sessionToDTO(s: SessionRow) {
  return {
    id: s.id,
    operatorId: s.operatorId,
    operatorName: s.operator.name,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
    openingFund: Number(s.openingFund),
    total: s.total != null ? Number(s.total) : null,
    withdrawals: s.withdrawals.map((w) => ({
      id: w.id,
      amount: Number(w.amount),
      reason: w.reason,
      createdAt: w.createdAt.toISOString(),
    })),
  }
}
