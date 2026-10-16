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
import { menuRoutes } from './routes/menu.js'
import { paymentsRoutes } from './routes/payments.js'
import { diagRoutes } from './routes/diag.js'
import { reqContext } from './lib/reqContext.js'
import { Diag } from './services/DiagService.js'
import { clients } from './ws/broadcast.js'
import { KitchenPrintService } from './services/KitchenPrintService.js'

const app = Fastify({ logger: { level: 'info' } })

// maxAge: o front envia cabeçalhos de diagnóstico (X-Device-Id etc.), que forçam
// preflight em GET; o cache evita um OPTIONS por requisição no Wi-Fi do bar.
await app.register(cors, { origin: true, maxAge: 7200 })
await app.register(websocket)

// Contexto de diagnóstico por requisição (aparelho, operador, tela) — ver lib/reqContext.ts
const hdr = (req: { headers: Record<string, unknown> }, name: string) => {
  const v = req.headers[name]
  return typeof v === 'string' && v.length > 0 ? v.slice(0, 120) : undefined
}
app.addHook('onRequest', (request, _reply, done) => {
  reqContext.run(
    {
      reqId: request.id as string,
      deviceId: hdr(request, 'x-device-id'),
      operatorId: hdr(request, 'x-operator-id'),
      screenSaleId: hdr(request, 'x-screen-sale'),
      route: hdr(request, 'x-route'),
      ua: hdr(request, 'user-agent'),
      ip: request.ip,
    },
    done,
  )
})

// Registra toda requisição relevante como evento (exclui ruído: polling, ws, catálogo, diag)
const DIAG_SKIP = /^\/(print\/pending|ws|health|products|menu|config|diag|cash\/active)(\/|\?|$)/
app.addHook('onResponse', (request, reply, done) => {
  if (!DIAG_SKIP.test(request.url)) {
    const url = request.url
    const m = url.match(/^\/sales\/(cm[a-z0-9]+)/)
    const body = request.method === 'GET' ? undefined : (request.body as Record<string, unknown> | undefined)
    Diag.log({
      type: 'request',
      saleId: m?.[1] ?? null,
      data: {
        method: request.method,
        url,
        status: reply.statusCode,
        ms: Math.round(reply.elapsedTime),
        reqId: request.id,
        ua: hdr(request, 'user-agent')?.slice(0, 80) ?? null,
        ip: request.ip,
        body: body && Object.keys(body).length ? body : undefined,
      },
    })
  }
  done()
})

// WebSocket endpoint — tablets/POS subscribe here for real-time table status
await app.register(async (instance) => {
  instance.get('/ws', { websocket: true }, (socket) => {
    clients.add(socket)
    socket.on('close', () => clients.delete(socket))
    // Sem este listener, um ECONNRESET (tablet dormiu/perdeu Wi-Fi) derruba o processo inteiro
    socket.on('error', () => clients.delete(socket))
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
await app.register(menuRoutes, { prefix: '/menu' })
await app.register(paymentsRoutes, { prefix: '/payments' })
await app.register(diagRoutes, { prefix: '/diag' })

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
