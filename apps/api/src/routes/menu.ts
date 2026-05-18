import type { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const menuRoutes: FastifyPluginAsync = async (app) => {
  // GET /menu — public endpoint, no auth required
  app.get('/', async () => {
    const categories = await prisma.category.findMany({
      where: {
        active: true,
        id: { not: 'cat_favoritos' },
      },
      orderBy: { displayOrder: 'asc' },
      include: {
        products: {
          where: { active: true },
          orderBy: { name: 'asc' },
          select: { name: true, price: true },
        },
      },
    })

    return categories
      .filter((c) => c.products.length > 0)
      .map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        color: c.color,
        products: c.products.map((p) => ({
          name: p.name,
          price: Number(p.price),
        })),
      }))
  })
}
