import type { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { LoginSchema } from '@pdv/shared'

const prisma = new PrismaClient()

export const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /auth/login — validates PIN and returns user info
  // The frontend stores the returned user in Zustand (no JWT needed for local LAN use)
  app.post('/login', async (request, reply) => {
    const result = LoginSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'PIN inválido', details: result.error.flatten() })
    }

    const { pin } = result.data

    // Find active users and check PIN against each (PINs are unique in practice)
    const users = await prisma.user.findMany({ where: { active: true } })
    let matched = null

    for (const user of users) {
      if (await bcrypt.compare(pin, user.pin)) {
        matched = user
        break
      }
    }

    if (!matched) {
      return reply.status(401).send({ error: 'PIN incorreto' })
    }

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
