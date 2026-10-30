/**
 * Local Print Agent — Betsbar PDV
 *
 * Optional env vars:
 *   RAILWAY_API_URL     — API endpoint (default: http://localhost:3000)
 *   PRINTER_INTERFACE   — win:NomeDaImpressora  (Windows USB via PowerShell)
 *                         cups:NomeDaImpressora (Mac USB via CUPS)
 *                         tcp://IP:PORT         (rede)
 *   PRINTER_IP          — fallback TCP IP
 *   PRINTER_PORT        — fallback TCP port (default 9100)
 *   PRINTER_WIDTH       — 58 or 80 (default 80)
 *   KITCHEN_PRINTER_IP  — cozinha TCP IP
 *   KITCHEN_PRINTER_PORT— cozinha TCP port (default 9100)
 *   POLL_MS             — polling interval ms (default 5000)
 */

// @ts-ignore
import ThermalPrinter from 'node-thermal-printer'
import { spawn } from 'node:child_process'

const API_URL       = (process.env.RAILWAY_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const PRINTER_WIDTH = Number(process.env.PRINTER_WIDTH ?? 80) as 58 | 80
const POLL_MS       = Number(process.env.POLL_MS ?? 5000)

// ─── Diagnóstico ──────────────────────────────────────────────
// Identifica este agente e reporta à API o que acontece com cada job
// (tentativa, falha, duração, ciclo sobreposto). Ver apps/api/src/routes/diag.ts.
import { hostname } from 'node:os'
const AGENT_ID = `${hostname()}:${process.pid}`
let polling = false
let pollSeq = 0

async function diag(type: string, data: Record<string, unknown>): Promise<void> {
  try {
    await fetch(`${API_URL}/diag/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'agent', deviceId: AGENT_ID, events: [{ type, ts: new Date().toISOString(), data: { ...data, agentId: AGENT_ID } }] }),
    })
  } catch { /* diagnóstico nunca bloqueia impressão */ }
}
const PRINTER_IFACE = process.env.PRINTER_INTERFACE ?? null
const KITCHEN_IFACE = process.env.KITCHEN_INTERFACE ?? null

let PRINTER_IP   = process.env.PRINTER_IP ?? ''
let PRINTER_PORT = Number(process.env.PRINTER_PORT ?? 9100)
let KITCHEN_IP   = process.env.KITCHEN_PRINTER_IP ?? ''
let KITCHEN_PORT = Number(process.env.KITCHEN_PRINTER_PORT ?? 9100)

const CHAR_COLS = PRINTER_WIDTH === 58 ? 32 : 48

function fmt(n: number) { return `R$ ${n.toFixed(2).replace('.', ',')}` }


// ─── Mac CUPS raw print via lp ────────────────────────────────
async function printViaCups(printerName: string, buf: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('lp', ['-d', printerName, '-o', 'raw', '-'])
    proc.stdin.write(buf)
    proc.stdin.end()
    proc.on('close', (code) => code === 0 ? resolve() : reject(new Error(`lp saiu com código ${code}`)))
    proc.on('error', reject)
  })
}

// ─── Printer factory ──────────────────────────────────────────

function makePrinter(ip: string, port: number, cols: number, ifaceOverride?: string | null) {
  // cups: mode builds ESC/POS in memory — dummy TCP, never connects
  const iface = ifaceOverride?.startsWith('cups:')
    ? 'tcp://127.0.0.1:19100'
    : ifaceOverride ?? `tcp://${ip}:${port}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const opts: any = {
    type: ThermalPrinter.types.EPSON,
    interface: iface,
    width: cols,
    characterSet: ThermalPrinter.CharacterSet.PC860_PORTUGUESE,
  }

  // printer: interface requires @thiagoelg/node-printer as driver (installed by iniciar.bat)
  if (ifaceOverride?.startsWith('printer:')) {
    try {
      opts.driver = require('@thiagoelg/node-printer')
    } catch {
      throw new Error('Driver USB não encontrado. Feche e abra o iniciar.bat novamente para instalar.')
    }
  }

  return new ThermalPrinter.ThermalPrinter(opts)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendBuffer(iface: string | null, ip: string, port: number, printer: any): Promise<void> {
  if (iface?.startsWith('cups:')) {
    await printViaCups(iface.slice(5), printer.getBuffer() as Buffer)
  } else {
    const ok = await printer.isPrinterConnected()
    if (!ok) throw new Error(`Impressora offline: ${iface ?? `${ip}:${port}`}`)
    await printer.execute()
  }
  printer.clear()
}

// ─── Payloads ─────────────────────────────────────────────────

interface PrintPayload {
  saleType: string
  date: string
  operatorName: string
  tableNumber: number | null
  customerName: string | null
  customerAddress: string | null
  items: { name: string; qty: number; unitPrice: number; subtotal: number; guest?: string | null }[]
  subtotal: number
  discount: number
  total: number
  payments: { method: string; amount: number; guest?: string | null }[]
  troco: number
  // Divisão por pessoa: conta de uma pessoa só / resumo por pessoa (mesa toda)
  guestName?: string | null
  guestSummary?: { name: string; total: number; paid: number }[]
  // Ticket de pedido no balcão (bebidas) — payload no formato de comprovante
  counterTicket?: boolean
}

interface KitchenPayload {
  tableNumber: number | null
  saleType: string
  operatorName: string
  printedAt: string
  items: { qty: number; name: string; notes: string | null; guest?: string | null }[]
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro', debit: 'Cartao Debito', credit: 'Cartao Credito',
  pix: 'Pix', voucher: 'Voucher', conta_receita: 'Conta Receita',
}

// ─── Receipt ──────────────────────────────────────────────────

async function printReceipt(payload: PrintPayload): Promise<void> {
  const printer = makePrinter(PRINTER_IP, PRINTER_PORT, CHAR_COLS, PRINTER_IFACE)

  printer.alignCenter()
  printer.setTextDoubleHeight()
  printer.bold(true)
  printer.println(payload.counterTicket ? 'PEDIDO - BALCAO' : 'Comprovante')
  printer.bold(false)
  printer.setTextNormal()
  printer.drawLine()

  printer.alignLeft()
  printer.println(new Date(payload.date).toLocaleString('pt-BR'))
  printer.println(`Operador: ${payload.operatorName}`)
  if (payload.tableNumber) printer.println(`Mesa: ${payload.tableNumber}`)
  if (payload.customerName) {
    printer.println(`Cliente: ${payload.customerName}`)
    if (payload.customerAddress) printer.println(payload.customerAddress)
  }
  if (payload.guestName) {
    printer.bold(true)
    printer.println(`CONTA DE: ${payload.guestName.toUpperCase()}`)
    printer.bold(false)
  }
  printer.drawLine()

  // Mesa com pessoas: itens agrupados por pessoa (itens da mesa primeiro)
  const hasGuests = !payload.guestName && payload.items.some((i) => i.guest)
  let lastGroup: string | null | undefined = undefined
  const ordered = hasGuests
    ? [...payload.items].sort((a, b) => (a.guest ?? '') === (b.guest ?? '') ? 0 : !a.guest ? -1 : !b.guest ? 1 : 0)
    : payload.items
  for (const item of ordered) {
    const group = item.guest ?? null
    if (hasGuests && group !== lastGroup) {
      printer.bold(true)
      printer.println(`[ ${(group ?? 'Mesa').toUpperCase()} ]`)
      printer.bold(false)
      lastGroup = group
    }
    printer.leftRight(`${item.qty}x ${item.name}`, fmt(item.subtotal))
  }
  printer.drawLine()

  if (payload.guestSummary && payload.guestSummary.length > 0) {
    printer.println('Por pessoa:')
    for (const g of payload.guestSummary) {
      const paid = g.paid > 0 ? `  pago ${fmt(g.paid)}` : ''
      printer.leftRight(`  ${g.name}${paid}`, fmt(g.total))
    }
    printer.drawLine()
  }

  if (payload.discount > 0) printer.leftRight('Desconto', `-${fmt(payload.discount)}`)
  printer.bold(true)
  printer.leftRight('TOTAL', fmt(payload.total))
  printer.bold(false)
  printer.drawLine()

  for (const p of payload.payments) {
    printer.leftRight(METHOD_LABELS[p.method] ?? p.method, fmt(p.amount))
  }
  if (payload.troco > 0) {
    printer.bold(true)
    printer.leftRight('Troco', fmt(payload.troco))
    printer.bold(false)
  }

  printer.drawLine()
  printer.alignCenter()
  if (!payload.counterTicket) printer.println('Obrigado pela visita!')
  printer.newLine()
  printer.cut()

  await sendBuffer(PRINTER_IFACE, PRINTER_IP, PRINTER_PORT, printer)
}

// ─── Kitchen comanda ──────────────────────────────────────────

async function printKitchen(payload: KitchenPayload): Promise<void> {
  const printer = makePrinter(KITCHEN_IP, KITCHEN_PORT, 48, KITCHEN_IFACE)

  const isConnected = await printer.isPrinterConnected()
  if (!isConnected) throw new Error(`Impressora cozinha offline: ${KITCHEN_IFACE ?? `${KITCHEN_IP}:${KITCHEN_PORT}`}`)

  const label = payload.tableNumber
    ? `Mesa: ${payload.tableNumber}`
    : payload.saleType === 'counter' ? 'Balcao' : 'Delivery'

  const time = new Date(payload.printedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  printer.alignCenter()
  printer.setTextDoubleHeight()
  printer.bold(true)
  printer.println('COMANDA - COZINHA')
  printer.bold(false)
  printer.setTextNormal()
  printer.drawLine()

  printer.alignLeft()
  printer.bold(true)
  printer.println(label)
  printer.bold(false)
  printer.println(`Garcom: ${payload.operatorName}   ${time}`)
  printer.drawLine()

  // Divisão por pessoa: agrupa por pessoa (itens da mesa primeiro)
  const hasGuests = payload.items.some((i) => i.guest)
  const groups: { guest: string | null; items: typeof payload.items }[] = []
  for (const it of payload.items) {
    const key = it.guest ?? null
    let g = groups.find((x) => x.guest === key)
    if (!g) { g = { guest: key, items: [] }; groups.push(g) }
    g.items.push(it)
  }
  groups.sort((a, b) => (a.guest === null ? -1 : b.guest === null ? 1 : 0))
  for (const group of groups) {
    if (hasGuests) {
      printer.bold(true)
      printer.println(`[ ${(group.guest ?? 'MESA').toUpperCase()} ]`)
      printer.bold(false)
    }
    for (const item of group.items) {
      printer.setTextDoubleHeight()
      printer.bold(true)
      printer.println(`${item.qty}x  ${item.name.toUpperCase()}`)
      printer.setTextNormal()
      printer.bold(false)
      if (item.notes) printer.println(`  Obs: ${item.notes}`)
    }
  }

  printer.drawLine()
  printer.newLine()
  printer.cut()
  await printer.execute()
  printer.clear()
}

// ─── Polling ──────────────────────────────────────────────────

interface PrintJob { id: string; type: string; payload: string; status: string }

async function fetchPending(): Promise<PrintJob[]> {
  const res = await fetch(`${API_URL}/print/pending`)
  if (!res.ok) throw new Error(`API retornou ${res.status}`)
  return res.json() as Promise<PrintJob[]>
}

async function markJob(jobId: string, action: 'printed' | 'skipped' | 'failed', extra: { error?: string; durationMs?: number } = {}) {
  const res = await fetch(`${API_URL}/print/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, agentId: AGENT_ID, ...extra }),
  })
  if (!res.ok) throw new Error(`PATCH /print/${jobId} retornou ${res.status}`)
}

async function poll(): Promise<void> {
  const seq = ++pollSeq
  if (polling) {
    // Ciclo anterior ainda rodando: comportamento mantido (o ciclo novo segue), só registra
    console.warn(`[agent] ciclo ${seq} iniciou com o anterior ainda em andamento`)
    void diag('agent.poll_overlap', { seq })
  }
  polling = true
  const started = Date.now()
  try {
    let jobs: PrintJob[]
    try {
      jobs = await fetchPending()
    } catch (err) {
      console.error('[agent] Erro ao buscar jobs:', (err as Error).message)
      void diag('agent.fetch_failed', { error: (err as Error).message })
      return
    }

    for (const job of jobs) {
      const t0 = Date.now()
      const tableNumber = tableOf(job.payload)
      try {
        await (job.type === 'kitchen'
        ? printKitchen(JSON.parse(job.payload) as KitchenPayload)
        : printReceipt(JSON.parse(job.payload) as PrintPayload))
        const durationMs = Date.now() - t0
        console.log(`[agent] ✓ Job ${job.id} (${job.type}, mesa ${tableNumber ?? '-'}) impresso em ${durationMs}ms`)
        try {
          await markJob(job.id, 'printed', { durationMs })
        } catch (err) {
          // Impresso mas não marcado: no próximo ciclo sairia de novo. Registra para rastrear duplicatas.
          console.error(`[agent] ! Job ${job.id} impresso mas falhou ao marcar:`, (err as Error).message)
          void diag('agent.mark_failed', { jobId: job.id, jobType: job.type, tableNumber, error: (err as Error).message })
        }
      } catch (err) {
        const durationMs = Date.now() - t0
        console.error(`[agent] ✗ Job ${job.id} (${job.type}, mesa ${tableNumber ?? '-'}) falhou em ${durationMs}ms:`, (err as Error).message)
        // deixa pendente para tentar no próximo ciclo; a API conta a tentativa
        markJob(job.id, 'failed', { error: (err as Error).message, durationMs }).catch(() => {})
      }
    }
  } finally {
    polling = false
    const ms = Date.now() - started
    if (ms > POLL_MS) void diag('agent.slow_poll', { seq, ms })
  }
}

function tableOf(payload: string): number | null {
  try { const t = (JSON.parse(payload) as { tableNumber?: number | null }).tableNumber; return typeof t === 'number' ? t : null } catch { return null }
}

// ─── Start ────────────────────────────────────────────────────

async function loadRemoteConfig() {
  if (process.env.PRINTER_IP && process.env.KITCHEN_PRINTER_IP) return
  try {
    const res = await fetch(`${API_URL}/config`)
    if (!res.ok) return
    const cfg = await res.json() as { printer: { ip: string; port: number }; kitchenPrinter: { ip: string; port: number } }
    if (!process.env.PRINTER_IP && cfg.printer?.ip) {
      PRINTER_IP = cfg.printer.ip
      if (!process.env.PRINTER_PORT) PRINTER_PORT = cfg.printer.port || 9100
    }
    if (!process.env.KITCHEN_PRINTER_IP && cfg.kitchenPrinter?.ip) {
      KITCHEN_IP = cfg.kitchenPrinter.ip
      if (!process.env.KITCHEN_PRINTER_PORT) KITCHEN_PORT = cfg.kitchenPrinter.port || 9100
    }
    console.log('[agent] Config carregada da API')
  } catch (err) {
    console.warn('[agent] Config remota indisponível:', (err as Error).message)
  }
  if (!KITCHEN_IP) KITCHEN_IP = PRINTER_IP
}

async function start() {
  await loadRemoteConfig()

  const balcaoLabel = PRINTER_IFACE?.startsWith('win:')  ? `Windows USB (${PRINTER_IFACE.slice(4)})`
                    : PRINTER_IFACE?.startsWith('cups:') ? `Mac CUPS (${PRINTER_IFACE.slice(5)})`
                    : PRINTER_IFACE ?? `${PRINTER_IP}:${PRINTER_PORT}`

  console.log(`[agent] Iniciado — API: ${API_URL}`)
  console.log(`[agent] Impressora balcão:  ${balcaoLabel}`)
  console.log(`[agent] Impressora cozinha: ${KITCHEN_IFACE ?? `${KITCHEN_IP}:${KITCHEN_PORT}`}`)
  console.log(`[agent] Polling a cada ${POLL_MS}ms\n`)

  void diag('agent.start', {
    printer: PRINTER_IFACE ?? `${PRINTER_IP}:${PRINTER_PORT}`,
    kitchen: KITCHEN_IFACE ?? `${KITCHEN_IP}:${KITCHEN_PORT}`,
    pollMs: POLL_MS, node: process.version, platform: process.platform,
  })
  void poll()
  setInterval(() => void poll(), POLL_MS)
}

void start()
