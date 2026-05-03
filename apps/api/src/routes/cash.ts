import type { FastifyPluginAsync } from 'fastify'
import { CashService } from '../services/CashService.js'

export const cashRoutes: FastifyPluginAsync = async (app) => {
  // GET /cash/active — current open session (or 404)
  app.get('/active', async (_req, reply) => {
    const session = await CashService.getActiveSession()
    if (!session) return reply.status(404).send({ error: 'Nenhum caixa aberto' })
    return session
  })

  // POST /cash/open — open a new session
  app.post('/open', async (request, reply) => {
    const { operatorId, openingFund } = request.body as {
      operatorId: string
      openingFund: number
    }
    if (!operatorId || openingFund == null)
      return reply.status(400).send({ error: 'operatorId e openingFund obrigatórios' })
    try {
      const session = await CashService.openSession(operatorId, openingFund)
      return reply.status(201).send(session)
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message })
    }
  })

  // GET /cash/:sessionId/report — full report for any session
  app.get('/:sessionId/report', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    try {
      return await CashService.getReport(sessionId)
    } catch {
      return reply.status(404).send({ error: 'Sessão não encontrada' })
    }
  })

  // POST /cash/:sessionId/withdraw — register a sangria
  app.post('/:sessionId/withdraw', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    const { amount, reason } = request.body as { amount: number; reason: string }
    if (!amount || !reason)
      return reply.status(400).send({ error: 'amount e reason obrigatórios' })
    try {
      const w = await CashService.withdraw(sessionId, amount, reason)
      return reply.status(201).send(w)
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message })
    }
  })

  // POST /cash/:sessionId/close — close session and return final report
  app.post('/:sessionId/close', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string }
    try {
      return await CashService.closeSession(sessionId)
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message })
    }
  })
}
