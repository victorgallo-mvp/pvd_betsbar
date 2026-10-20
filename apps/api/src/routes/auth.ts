import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '../lib/prisma.js'
import bcrypt from 'bcryptjs'
import { LoginSchema } from '@pdv/shared'
import { Diag } from '../services/DiagService.js'
import { ctx } from '../lib/reqContext.js'

// Limite de tentativas: 5 erros seguidos bloqueiam por 15 min.
// Chave = id do aparelho (cabeçalho X-Device-Id) ou, na falta, o IP de origem.
// Em memória: zera se a API reiniciar, o que é aceitável para esse fim.
const MAX_FAILURES = 5
const LOCK_MS = 15 * 60 * 1000
const attempts = new Map<string, { failures: number; lockedUntil: number }>()

function clientKey(request: { headers: Record<string, unknown>; ip: string }): string {
  const dev = ctx().deviceId
  if (dev) return `dev:${dev}`
  const fwd = request.headers['x-forwarded-for']
  const ip = typeof fwd === 'string' && fwd.length > 0 ? fwd.split(',')[0]!.trim() : request.ip
  return `ip:${ip}`
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /auth/login — validates PIN and returns user info
  // The frontend stores the returned user in Zustand (no JWT needed for local LAN use)
  app.post('/login', async (request, reply) => {
    const key = clientKey(request)
    const now = Date.now()
    const state = attempts.get(key)
    if (state && state.lockedUntil > now) {
      const minutes = Math.ceil((state.lockedUntil - now) / 60000)
      Diag.log({ type: 'auth.locked', data: { key, minutesLeft: minutes } })
      return reply.status(429).send({ error: `Muitas tentativas. Aguarde ${minutes} min.` })
    }

    const result = LoginSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'PIN deve ter 6 dígitos' })
    }

    const { pin } = result.data

    // Find active users and check PIN against each (PINs are unique — garantido no cadastro)
    const users = await prisma.user.findMany({ where: { active: true } })
    let matched = null

    for (const user of users) {
      if (await bcrypt.compare(pin, user.pin)) {
        matched = user
        break
      }
    }

    if (!matched) {
      const failures = (state?.failures ?? 0) + 1
      const locked = failures >= MAX_FAILURES
      attempts.set(key, { failures: locked ? 0 : failures, lockedUntil: locked ? now + LOCK_MS : 0 })
      Diag.log({ type: locked ? 'auth.locked' : 'auth.failed', data: { key, failures } })
      if (locked) return reply.status(429).send({ error: 'Muitas tentativas. Aguarde 15 min.' })
      return reply.status(401).send({ error: 'PIN incorreto' })
    }

    attempts.delete(key)
    Diag.log({ type: 'auth.ok', operatorId: matched.id, data: { key, name: matched.name, role: matched.role } })

    return {
      id: matched.id,
      name: matched.name,
      role: matched.role,
      active: matched.active,
    }
  })

  // GET /auth/operators — lists active operators (for display on PIN screen)
  app.get('/operators', async () => {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    })
    return users
  })
}
