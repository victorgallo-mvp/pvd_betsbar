import type { FastifyPluginAsync } from 'fastify'
import { SaleService } from '../services/SaleService.js'
import { KitchenPrintService } from '../services/KitchenPrintService.js'
import {
  OpenSaleSchema,
  AddItemSchema,
  RequestBillSchema,
  RegisterPaymentSchema,
} from '@pdv/shared'

export const salesRoutes: FastifyPluginAsync = async (app) => {
  // POST /sales — open new sale
  app.post('/', async (request, reply) => {
    const parsed = OpenSaleSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })

    const body = request.body as { operatorId?: string }
    const operatorId = body.operatorId as string
    if (!operatorId) return reply.status(400).send({ error: 'operatorId obrigatório' })

    const sale = await SaleService.openSale({ ...parsed.data, operatorId })
    return reply.status(201).send(sale)
  })

  // GET /sales/:id
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      return await SaleService.getSale(id)
    } catch {
      return reply.status(404).send({ error: 'Venda não encontrada' })
    }
  })

  // POST /sales/:id/items — add item to sale
  app.post('/:id/items', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = AddItemSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    return SaleService.addItem(id, parsed.data)
  })

  // DELETE /sales/:id/items/:itemId — remove 1 unit (pending items only)
  app.delete('/:id/items/:itemId', async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string }
    try {
      return await SaleService.removeItem(id, itemId)
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message })
    }
  })

  // POST /sales/:id/conclude — print kitchen ticket + mark items as sent to production
  app.post('/:id/conclude', async (request) => {
    const { id } = request.params as { id: string }
    const kitchen = await KitchenPrintService.printOrder(id)
    const sale = await SaleService.recalcAndGet(id)
    return { ...sale, _kitchen: kitchen }
  })

  // POST /sales/:id/request-bill — pedir conta com divisão por pessoas
  app.post('/:id/request-bill', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = RequestBillSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    return SaleService.requestBill(id, parsed.data)
  })

  // PATCH /sales/:id/items/:itemId/cancel — cancel a sent item + queue kitchen cancel notice
  app.patch('/:id/items/:itemId/cancel', async (request, reply) => {
    const { id, itemId } = request.params as { id: string; itemId: string }
    try {
      return await SaleService.cancelItem(id, itemId)
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message })
    }
  })

  // PATCH /sales/:id — update mutable fields (customerName, customerAddress)
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { customerName?: string; customerAddress?: string }
    try {
      return await SaleService.updateSale(id, body)
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message })
    }
  })

  // DELETE /sales/:id — cancel sale + free table
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await SaleService.cancelSale(id)
      return reply.status(204).send()
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message })
    }
  })

  // POST /sales/:id/payments — registrar pagamento
  app.post('/:id/payments', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = RegisterPaymentSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: parsed.error.flatten() })
    return SaleService.registerPayment(id, parsed.data)
  })
}
