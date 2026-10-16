// Diário de diagnóstico do aparelho.
//
// Guarda eventos localmente (localStorage) e envia em lote para POST /diag/events.
// Se a rede estiver fora, a fila fica no aparelho e sobe quando voltar — é
// justamente nesses momentos que precisamos enxergar o que aconteceu.
// Nunca lança erro: diagnóstico não pode derrubar a venda.

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'
const QUEUE_KEY = 'pdv-diag-queue'
const DEVICE_KEY = 'pdv-device-id'
const MAX_QUEUE = 1500
const FLUSH_MS = 5000

export interface DiagEvent {
  type: string
  ts: string
  deviceId: string
  operatorId: string | null
  screenSaleId: string | null
  route: string
  saleId?: string | null
  tableNumber?: number | null
  data?: unknown
}

interface Context {
  operatorId: string | null
  screenSaleId: string | null
  screenTable: number | null
}

let contextProvider: () => Context = () => ({ operatorId: null, screenSaleId: null, screenTable: null })

// App.tsx registra um provedor que lê os stores (evita import circular api -> diag -> store -> api)
export function setDiagContextProvider(fn: () => Context) {
  contextProvider = fn
}

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSet(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* modo privado / sem espaço */ }
}

function makeId(): string {
  const rnd = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36))
  return 'dev_' + rnd.replace(/-/g, '').slice(0, 16)
}

export function getDeviceId(): string {
  let id = safeGet(DEVICE_KEY)
  if (!id) { id = makeId(); safeSet(DEVICE_KEY, id) }
  return id
}

export function getDiagContext(): Context {
  try { return contextProvider() } catch { return { operatorId: null, screenSaleId: null, screenTable: null } }
}

let queue: DiagEvent[] = (() => {
  try { const raw = safeGet(QUEUE_KEY); return raw ? (JSON.parse(raw) as DiagEvent[]) : [] } catch { return [] }
})()
let flushing = false
let timer: ReturnType<typeof setInterval> | null = null

function persist() {
  if (queue.length > MAX_QUEUE) queue = queue.slice(queue.length - MAX_QUEUE)
  safeSet(QUEUE_KEY, JSON.stringify(queue))
}

export function track(type: string, data?: Record<string, unknown> & { saleId?: string | null; tableNumber?: number | null }) {
  try {
    const c = getDiagContext()
    const { saleId, tableNumber, ...rest } = data ?? {}
    queue.push({
      type,
      ts: new Date().toISOString(),
      deviceId: getDeviceId(),
      operatorId: c.operatorId,
      screenSaleId: c.screenSaleId,
      route: typeof location !== 'undefined' ? location.pathname : '',
      saleId: saleId ?? null,
      tableNumber: tableNumber ?? c.screenTable ?? null,
      data: { ...rest, online: typeof navigator !== 'undefined' ? navigator.onLine : null },
    })
    persist()
  } catch { /* nunca quebra o fluxo */ }
}

export async function flush(useBeacon = false): Promise<void> {
  if (flushing || queue.length === 0) return
  const batch = queue.slice(0, 200)
  const body = JSON.stringify({ source: 'client', deviceId: getDeviceId(), events: batch })
  if (useBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    // pagehide/visibilitychange: o beacon sobrevive ao fechamento da página
    const ok = navigator.sendBeacon(`${BASE}/diag/events`, new Blob([body], { type: 'application/json' }))
    if (ok) { queue = queue.slice(batch.length); persist() }
    return
  }
  flushing = true
  try {
    const res = await fetch(`${BASE}/diag/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Id': getDeviceId() },
      body,
      signal: AbortSignal.timeout(10_000),
      keepalive: true,
    })
    if (res.ok) { queue = queue.slice(batch.length); persist() }
  } catch { /* fica na fila */ } finally { flushing = false }
}

// Chamado uma vez em App.tsx
export function startDiag() {
  if (timer) return
  timer = setInterval(() => { void flush() }, FLUSH_MS)
  window.addEventListener('online', () => { track('net', { state: 'online' }); void flush() })
  window.addEventListener('offline', () => track('net', { state: 'offline' }))
  document.addEventListener('visibilitychange', () => {
    track('visibility', { state: document.visibilityState })
    if (document.visibilityState === 'hidden') void flush(true)
  })
  window.addEventListener('pagehide', () => { void flush(true) })
  window.addEventListener('error', (e) => track('js_error', { message: String(e.message).slice(0, 300), source: e.filename, line: e.lineno }))
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as { message?: string; name?: string } | undefined
    track('js_error', { unhandled: true, name: r?.name ?? null, message: String(r?.message ?? r).slice(0, 300) })
  })
  track('app_start', {
    ua: navigator.userAgent.slice(0, 160),
    standalone: window.matchMedia('(display-mode: standalone)').matches,
    screen: `${window.screen.width}x${window.screen.height}`,
    queued: queue.length,
  })
  void flush()
}
