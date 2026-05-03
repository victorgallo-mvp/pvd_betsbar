import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { tablesRoutes } from './routes/tables.js'
import { productsRoutes } from './routes/products.js'
import { salesRoutes } from './routes/sales.js'
import { printRoutes } from './routes/print.js'
import { cashRoutes } from './routes/cash.js'
import { adminRoutes } from './routes/admin.js'
import { reportsRoutes } from './routes/reports.js'
import { configRoutes } from './routes/config.js'
import { clients } from './ws/broadcast.js'
import { KitchenPrintService } from './services/KitchenPrintService.js'

const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, { origin: true })
await app.register(websocket)

// WebSocket endpoint — tablets/POS subscribe here for real-time table status
await app.register(async (instance) => {
  instance.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket)
    socket.on('close', () => clients.delete(socket))
  })
})

await app.register(healthRoutes)
await app.register(authRoutes, { prefix: '/auth' })
await app.register(tablesRoutes, { prefix: '/tables' })
await app.register(productsRoutes, { prefix: '/products' })
await app.register(salesRoutes, { prefix: '/sales' })
await app.register(printRoutes, { prefix: '/print' })
await app.register(cashRoutes, { prefix: '/cash' })
await app.register(adminRoutes, { prefix: '/admin' })
await app.register(reportsRoutes, { prefix: '/reports' })
await app.register(configRoutes, { prefix: '/config' })

const port = Number(process.env.PORT ?? 3001)

try {
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`🚀 API running on http://localhost:${port}`)
  setInterval(() => {
    KitchenPrintService.retryFailedJobs().catch(console.error)
  }, 30_000)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
