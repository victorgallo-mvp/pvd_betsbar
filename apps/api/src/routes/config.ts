import type { FastifyPluginAsync } from 'fastify'
import { readConfig, writeConfig } from '../appConfig.js'
import { PrintService } from '../services/PrintService.js'

export const configRoutes: FastifyPluginAsync = async (app) => {
  app.get('/', async () => readConfig())

  app.patch('/', async (request) => {
    const patch = request.body as Parameters<typeof writeConfig>[0]
    return writeConfig(patch)
  })

  // POST /config/test-print — sends a test page to the configured printer
  app.post('/test-print', async (_req, reply) => {
    try {
      const result = await PrintService.testPrint()
      return result
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message })
    }
  })
}
