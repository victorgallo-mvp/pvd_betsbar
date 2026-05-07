import type { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { PrintService } from '../services/PrintService.js'

const prisma = new PrismaClient()

export const printRoutes: FastifyPluginAsync = async (app) => {
  // GET /print/pending — list all pending print jobs (used by local print agent)
  app.get('/pending', async (_request, reply) => {
    const jobs = await prisma.printJob.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })
    return reply.send(jobs)
  })

  // POST /print/sale/:saleId — create a fiche job (only works if sale is paid)
  app.post('/sale/:saleId', async (request, reply) => {
    const { saleId } = request.params as { saleId: string }
    try {
      const job = await PrintService.createFicheJob(saleId)
      return reply.status(201).send(job)
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message })
    }
  })

  // GET /print/:jobId — fetch job and its payload
  app.get('/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string }
    try {
      const job = await PrintService.getJob(jobId)
      return { ...job, payloadParsed: JSON.parse(job.payload) }
    } catch {
      return reply.status(404).send({ error: 'Job não encontrado' })
    }
  })

  // PATCH /print/:jobId — mark as printed or skipped
  app.patch('/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string }
    const { action } = request.body as { action: 'printed' | 'skipped' }
    if (!['printed', 'skipped'].includes(action)) {
      return reply.status(400).send({ error: 'action deve ser "printed" ou "skipped"' })
    }
    return PrintService.markJob(jobId, action)
  })
}
