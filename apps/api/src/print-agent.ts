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
  items: { name: string; qty: number; unitPrice: number; subtotal: number }[]
  subtotal: number
  discount: number
  total: number
  payments: { method: string; amount: number }[]
  troco: number
}

interface KitchenPayload {
  tableNumber: number | null
  saleType: string
  operatorName: string
  printedAt: string
  items: { qty: number; name: string; notes: string | null }[]
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
  printer.println('Comprovante')
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
  printer.drawLine()

  for (const item of payload.items) {
    printer.leftRight(`${item.qty}x ${item.name}`, fmt(item.subtotal))
  }
  printer.drawLine()

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
  printer.println('Obrigado pela visita!')
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

  for (const item of payload.items) {
    printer.setTextDoubleHeight()
    printer.bold(true)
    printer.println(`${item.qty}x  ${item.name.toUpperCase()}`)
    printer.setTextNormal()
    printer.bold(false)
    if (item.notes) printer.println(`  Obs: ${item.notes}`)
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

async function markJob(jobId: string, action: 'printed' | 'skipped') {
  await fetch(`${API_URL}/print/${jobId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
}

async function poll(): Promise<void> {
  let jobs: PrintJob[]
  try { jobs = await fetchPending() } catch (err) {
    console.error('[agent] Erro ao buscar jobs:', (err as Error).message)
    return
  }
  for (const job of jobs) {
    try {
      await (job.type === 'kitchen'
        ? printKitchen(JSON.parse(job.payload) as KitchenPayload)
        : printReceipt(JSON.parse(job.payload) as PrintPayload))
      await markJob(job.id, 'printed')
      console.log(`[agent] ✓ Job ${job.id} (${job.type}) impresso`)
    } catch (err) {
      console.error(`[agent] ✗ Job ${job.id} falhou:`, (err as Error).message)
    }
  }
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

  void poll()
  setInterval(() => void poll(), POLL_MS)
}

void start()
