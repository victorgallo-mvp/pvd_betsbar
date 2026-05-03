import type { FastifyPluginAsync } from 'fastify'
import { ReportService } from '../services/ReportService.js'

function parseRange(query: Record<string, string>) {
  const now = new Date()

  const from = query.from
    ? new Date(query.from + 'T00:00:00')
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)

  const to = query.to
    ? new Date(query.to + 'T23:59:59')
    : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)

  return { from, to }
}

export const reportsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/summary', async (request) => {
    const { from, to } = parseRange(request.query as Record<string, string>)
    return ReportService.getSummary(from, to)
  })

  app.get('/by-method', async (request) => {
    const { from, to } = parseRange(request.query as Record<string, string>)
    return ReportService.getByPaymentMethod(from, to)
  })

  app.get('/by-product', async (request) => {
    const { from, to } = parseRange(request.query as Record<string, string>)
    return ReportService.getByProduct(from, to)
  })

  app.get('/by-operator', async (request) => {
    const { from, to } = parseRange(request.query as Record<string, string>)
    return ReportService.getByOperator(from, to)
  })
}
