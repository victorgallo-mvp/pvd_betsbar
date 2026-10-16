import { useEffect, useRef } from 'react'
import type { WsMessage } from '@pdv/shared'
import { useTables } from '../stores/useTables'
import { track } from '../lib/diag'

// Connects to the WebSocket server and dispatches table_update events to the
// useTables store. Reconnects automatically after a disconnect.
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateTable = useTables((s) => s.updateTable)

  useEffect(() => {
    function connect() {
      const apiUrl = import.meta.env.VITE_API_URL as string | undefined
      const wsUrl = apiUrl
        ? apiUrl.replace(/^http/, 'ws') + '/ws'
        : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      const openedAt = Date.now()

      ws.onopen = () => track('ws', { state: 'open' })
      ws.onerror = () => track('ws', { state: 'error' })
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string) as WsMessage
          if (msg.event === 'table_update') {
            updateTable(msg.table)
            track('ws_table_update', { tableNumber: msg.table.number, status: msg.table.status })
          }
        } catch {
          // ignore malformed messages
        }
      }

      ws.onclose = (evt) => {
        track('ws', { state: 'close', code: evt.code, clean: evt.wasClean, aliveMs: Date.now() - openedAt })
        reconnectTimer.current = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      wsRef.current?.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [updateTable])
}
