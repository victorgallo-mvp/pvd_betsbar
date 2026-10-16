import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { PrintService } from '../services/PrintService.js'
import { Diag } from '../services/DiagService.js'


function tableOf(payload: string): number | null {
  try {
    const t = (JSON.parse(payload) as { tableNumber?: number | null }).tableNumber
    return typeof t === 'number' ? t : null
  } catch {
    return null
  }
}

export const printRoutes: FastifyPluginAsync = async (app) => {
  // GET /print/pending — list all pending print jobs (used by local print agent)
  app.get('/pending', async (_request, reply) => {
    const jobs = await prisma.printJob.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 20,
    })
    // Diagnóstico: marca a primeira busca de cada job e registra fila não vazia
    const fresh = jobs.filter((j) => !j.fetchedAt)
    if (fresh.length > 0) {
      const now = new Date()
      prisma.printJob
        .updateMany({ where: { id: { in: fresh.map((j) => j.id) } }, data: { fetchedAt: now } })
        .catch(() => {})
    }
    if (jobs.length > 0) {
      const now = Date.now()
      Diag.log({
        type: 'print.fetched',
        data: {
          count: jobs.length,
          jobs: jobs.map((j) => ({
            id: j.id, type: j.type, saleId: j.saleId, attempts: j.attempts,
            ageMs: now - j.createdAt.getTime(), tableNumber: tableOf(j.payload),
          })),
        },
      })
    }
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

  // PATCH /print/:jobId — mark as printed, skipped or failed (failed mantém pendente e conta a tentativa)
  app.patch('/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string }
    const body = request.body as { action: 'printed' | 'skipped' | 'failed'; error?: string; agentId?: string; durationMs?: number }
    const { action } = body
    if (!['printed', 'skipped', 'failed'].includes(action)) {
      return reply.status(400).send({ error: 'action deve ser "printed", "skipped" ou "failed"' })
    }
    const job = await prisma.printJob.findUnique({ where: { id: jobId } })
    if (!job) return reply.status(404).send({ error: 'Job não encontrado' })
    const base = {
      saleId: job.saleId,
      tableNumber: tableOf(job.payload),
      data: {
        jobId, jobType: job.type, trigger: job.triggerEvent, attempts: job.attempts + 1,
        agentId: body.agentId ?? null, durationMs: body.durationMs ?? null,
        latencyMs: Date.now() - job.createdAt.getTime(), previousStatus: job.status,
      },
    }
    if (action === 'failed') {
      const updated = await prisma.printJob.update({
        where: { id: jobId },
        data: { attempts: { increment: 1 }, lastError: (body.error ?? 'erro desconhecido').slice(0, 500), agentId: body.agentId ?? job.agentId },
      })
      Diag.log({ type: 'print.failed', ...base, data: { ...base.data, error: body.error ?? null } })
      return updated
    }
    if (job.status !== 'pending') {
      // Marcação repetida: dois agentes ou ciclo sobreposto
      Diag.log({ type: 'conflict.print_marked_twice', ...base })
    }
    const updated = await prisma.printJob.update({
      where: { id: jobId },
      data: {
        status: action, printedAt: action === 'printed' ? new Date() : null,
        attempts: { increment: 1 }, agentId: body.agentId ?? job.agentId,
      },
    })
    Diag.log({ type: action === 'printed' ? 'print.printed' : 'print.skipped', ...base })
    return updated
  })
}
