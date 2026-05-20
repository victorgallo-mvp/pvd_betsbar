import type { FastifyPluginAsync } from 'fastify'
import { AdminService } from '../services/AdminService.js'

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // ── Products ──────────────────────────────────────────────
  app.get('/products', async () => AdminService.listProducts())

  app.post('/products', async (request, reply) => {
    const body = request.body as { categoryId: string; name: string; price: number; isFavorite?: boolean; sendToKitchen?: boolean }
    if (!body.categoryId || !body.name || body.price == null)
      return reply.status(400).send({ error: 'categoryId, name e price são obrigatórios' })
    return reply.status(201).send(
      await AdminService.createProduct({
        ...body,
        isFavorite: body.isFavorite ?? false,
        sendToKitchen: body.sendToKitchen ?? true,
      }),
    )
  })

  app.patch('/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Record<string, unknown>
    try {
      return await AdminService.updateProduct(id, body as Parameters<typeof AdminService.updateProduct>[1])
    } catch {
      return reply.status(404).send({ error: 'Produto não encontrado' })
    }
  })

  app.delete('/products/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await AdminService.removeProduct(id)
      return reply.status(204).send()
    } catch (e) {
      return reply.status(400).send({ error: (e as Error).message })
    }
  })

  // ── Categories ────────────────────────────────────────────
  app.get('/categories', async () => AdminService.listCategories())

  app.post('/categories', async (request, reply) => {
    const body = request.body as { name: string; color: string; icon: string; displayOrder?: number }
    if (!body.name || !body.color || !body.icon)
      return reply.status(400).send({ error: 'name, color e icon são obrigatórios' })
    const maxOrder = await (async () => {
      const cats = await AdminService.listCategories()
      return cats.reduce((m, c) => Math.max(m, c.displayOrder), 0)
    })()
    return reply.status(201).send(
      await AdminService.createCategory({ ...body, displayOrder: body.displayOrder ?? maxOrder + 1 }),
    )
  })

  app.patch('/categories/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as Record<string, unknown>
    try {
      return await AdminService.updateCategory(id, body as Parameters<typeof AdminService.updateCategory>[1])
    } catch {
      return reply.status(404).send({ error: 'Categoria não encontrada' })
    }
  })

  // ── Tables ────────────────────────────────────────────────
  app.get('/tables', async () => AdminService.listAllTables())

  app.post('/tables', async (request, reply) => {
    const { number } = request.body as { number: number }
    if (!number) return reply.status(400).send({ error: 'number é obrigatório' })
    try {
      return reply.status(201).send(await AdminService.createTable(number))
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message })
    }
  })

  app.delete('/tables/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await AdminService.removeTable(id)
      return reply.status(204).send()
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message })
    }
  })

  // ── Users ─────────────────────────────────────────────────
  app.get('/users', async () => AdminService.listUsers())

  app.post('/users', async (request, reply) => {
    const body = request.body as { name: string; pin: string; role: string }
    if (!body.name || !body.pin || !body.role)
      return reply.status(400).send({ error: 'name, pin e role são obrigatórios' })
    return reply.status(201).send(await AdminService.createUser(body))
  })

  app.patch('/users/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { name?: string; role?: string; active?: boolean; pin?: string }
    try {
      if (body.pin) {
        await AdminService.changePin(id, body.pin)
        const { pin: _, ...rest } = body
        if (Object.keys(rest).length > 0) return AdminService.updateUser(id, rest)
        return AdminService.listUsers().then((users) => users.find((u) => u.id === id))
      }
      return await AdminService.updateUser(id, body)
    } catch {
      return reply.status(404).send({ error: 'Usuário não encontrado' })
    }
  })
}
