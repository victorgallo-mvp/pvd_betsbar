import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'


const VALID_METHODS = ['cash', 'debit', 'credit', 'pix', 'voucher', 'conta_receita']

export const paymentsRoutes: FastifyPluginAsync = async (app) => {
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const { method } = request.body as { method: string }

    if (!VALID_METHODS.includes(method)) {
      return reply.status(400).send({ error: 'Método de pagamento inválido' })
    }

    try {
      const p = await prisma.payment.update({ where: { id }, data: { method } })
      return { id: p.id, method: p.method, amount: Number(p.amount), paidAt: p.paidAt.toISOString() }
    } catch {
      return reply.status(404).send({ error: 'Pagamento não encontrado' })
    }
  })
}
