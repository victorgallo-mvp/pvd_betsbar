import type { WebSocket } from '@fastify/websocket'

export const clients = new Set<WebSocket>()

export function broadcast(message: unknown) {
  const json = JSON.stringify(message)
  for (const client of clients) {
    if (client.readyState === 1) client.send(json)
  }
}
