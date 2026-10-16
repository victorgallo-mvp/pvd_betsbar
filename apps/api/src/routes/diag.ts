import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { Diag, type DiagInput } from '../services/DiagService.js'

interface ClientEvent {
  type: string
  ts?: string
  deviceId?: string
  operatorId?: string | null
  saleId?: string | null
  tableNumber?: number | null
  screenSaleId?: string | null
  route?: string | null
  data?: unknown
}

export const diagRoutes: FastifyPluginAsync = async (app) => {
  // POST /diag/events — lote de eventos vindos do celular ou do agente
  app.post('/events', async (request, reply) => {
    const body = request.body as { source?: 'client' | 'agent'; deviceId?: string; events?: ClientEvent[] }
    const events = Array.isArray(body?.events) ? body.events.slice(0, 500) : []
    const source = body.source === 'agent' ? 'agent' : 'client'
    const rows: DiagInput[] = events
      .filter((e) => e && typeof e.type === 'string')
      .map((e) => ({
        source,
        type: e.type.slice(0, 60),
        deviceId: e.deviceId ?? body.deviceId ?? null,
        operatorId: e.operatorId ?? null,
        saleId: e.saleId ?? null,
        tableNumber: typeof e.tableNumber === 'number' ? e.tableNumber : null,
        screenSaleId: e.screenSaleId ?? null,
        route: e.route ?? null,
        data: e.data,
        clientTs: e.ts && !Number.isNaN(Date.parse(e.ts)) ? new Date(e.ts) : null,
      }))
    try {
      const count = await Diag.logMany(rows)
      return { ok: true, count }
    } catch (err) {
      request.log.error({ err }, '[diag] falha ao gravar lote')
      return reply.status(500).send({ error: 'falha ao gravar' })
    }
  })

  // GET /diag/events?since&until&deviceId&saleId&type&source&limit — consulta bruta
  app.get('/events', async (request) => {
    const q = request.query as Record<string, string | undefined>
    const limit = Math.min(Number(q.limit ?? 1000), 10000)
    const where: Record<string, unknown> = {}
    if (q.since || q.until) {
      where.createdAt = {
        ...(q.since && { gte: new Date(q.since) }),
        ...(q.until && { lte: new Date(q.until) }),
      }
    }
    if (q.deviceId) where.deviceId = q.deviceId
    if (q.saleId) where.saleId = q.saleId
    if (q.source) where.source = q.source
    if (q.type) where.type = q.type.includes('*') ? { startsWith: q.type.replace('*', '') } : q.type
    if (q.tableNumber) where.tableNumber = Number(q.tableNumber)
    const rows = await prisma.diagEvent.findMany({ where, orderBy: { createdAt: 'asc' }, take: limit })
    return rows.map((r) => ({ ...r, data: r.data ? JSON.parse(r.data) : null }))
  })

  // GET /diag/summary?date=YYYY-MM-DD — contadores do dia (BRT)
  app.get('/summary', async (request) => {
    const q = request.query as { date?: string }
    const date = q.date ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const from = new Date(date + 'T00:00:00-03:00')
    const to = new Date(date + 'T23:59:59.999-03:00')
    const rows = await prisma.diagEvent.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { source: true, type: true, deviceId: true, data: true },
    })
    const byType: Record<string, number> = {}
    const byDevice: Record<string, number> = {}
    let failedRequests = 0
    for (const r of rows) {
      const k = `${r.source}:${r.type}`
      byType[k] = (byType[k] ?? 0) + 1
      if (r.deviceId) byDevice[r.deviceId] = (byDevice[r.deviceId] ?? 0) + 1
      if (r.type === 'request' && r.source === 'client' && r.data && !r.data.includes('"ok":true')) failedRequests++
    }
    const printJobs = await prisma.printJob.groupBy({
      by: ['status'],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      _max: { attempts: true },
    })
    return { date, total: rows.length, failedClientRequests: failedRequests, byType, byDevice, printJobs }
  })
}
