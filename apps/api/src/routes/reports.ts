import type { FastifyPluginAsync } from 'fastify'
import { ReportService } from '../services/ReportService.js'

// All date strings from the client are treated as Brasília time (UTC-3).
// Brazil abolished DST in 2019, so -03:00 is always correct.
function parseRange(query: Record<string, string>) {
  const todayBRT = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })

  const from = new Date((query.from ?? todayBRT) + 'T00:00:00-03:00')
  const to   = new Date((query.to   ?? todayBRT) + 'T23:59:59.999-03:00')

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
