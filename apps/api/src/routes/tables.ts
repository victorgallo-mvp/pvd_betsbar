import type { FastifyPluginAsync } from 'fastify'
import { SaleService } from '../services/SaleService.js'

export const tablesRoutes: FastifyPluginAsync = async (app) => {
  // GET /tables — all tables with current status
  app.get('/', async () => SaleService.getTables())

  // GET /tables/:tableId/active-sale — open or awaiting_payment sale for a table
  app.get('/:tableId/active-sale', async (request, reply) => {
    const { tableId } = request.params as { tableId: string }
    const sale = await SaleService.getActiveSaleForTable(tableId)
    if (!sale) return reply.status(404).send({ error: 'Sem venda ativa' })
    return sale
  })
}
