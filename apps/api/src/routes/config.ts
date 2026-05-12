import type { FastifyPluginAsync } from 'fastify'
import { readConfig, writeConfig } from '../appConfig.js'
import { PrintService } from '../services/PrintService.js'
import { KitchenPrintService } from '../services/KitchenPrintService.js'

export const configRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => readConfig())

  app.patch('/', async (request) => {
    const patch = request.body as Parameters<typeof writeConfig>[0]
    return writeConfig(patch)
  })

  // POST /config/test-print — sends a test page to the receipt printer
  app.post('/test-print', async (_req, reply) => {
    try {
      const result = await PrintService.testPrint()
      return result
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message })
    }
  })

  // POST /config/test-kitchen-print — sends a test page to the kitchen printer
  app.post('/test-kitchen-print', async (_req, reply) => {
    try {
      const result = await KitchenPrintService.testPrint()
      return result
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message })
    }
  })
}
