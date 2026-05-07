/**
 * Local Print Agent
 *
 * Runs on the restaurant machine (not on Railway).
 * Polls the Railway API for pending print jobs and sends them to the
 * local thermal printer via TCP.
 *
 * Usage:
 *   RAILWAY_API_URL=https://...up.railway.app \
 *   PRINTER_IP=192.168.1.xxx \
 *   pnpm --filter api run agent
 *
 * Optional env vars:
 *   PRINTER_PORT        — default 9100 (ignorado se PRINTER_INTERFACE definido)
 *   PRINTER_WIDTH       — 58 or 80 (default 80)
 *   PRINTER_INTERFACE   — sobrescreve interface diretamente, ex: "printer:POS-80" (USB no Windows)
 *   KITCHEN_PRINTER_IP  — se diferente de PRINTER_IP
 *   KITCHEN_PRINTER_PORT— default 9100
 *   KITCHEN_INTERFACE   — sobrescreve interface da cozinha
 *   POLL_MS             — polling interval in ms (default 5000)
 */

// @ts-ignore
import ThermalPrinter from 'node-thermal-printer'

const API_URL          = (process.env.RAILWAY_API_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const PRINTER_IP       = process.env.PRINTER_IP ?? '192.168.1.100'
const PRINTER_PORT     = Number(process.env.PRINTER_PORT ?? 9100)
const PRINTER_WIDTH    = Number(process.env.PRINTER_WIDTH ?? 80) as 58 | 80
const KITCHEN_IP       = process.env.KITCHEN_PRINTER_IP ?? PRINTER_IP
const KITCHEN_PORT     = Number(process.env.KITCHEN_PRINTER_PORT ?? 9100)
const POLL_MS          = Number(process.env.POLL_MS ?? 5000)
// Quando definido, usa a string de interface diretamente em vez de TCP (ex: "printer:POS-80")
const PRINTER_IFACE    = process.env.PRINTER_INTERFACE ?? null
const KITCHEN_IFACE    = process.env.KITCHEN_INTERFACE ?? PRINTER_IFACE

const CHAR_COLS = PRINTER_WIDTH === 58 ? 32 : 48

function fmt(n: number) { return `R$ ${n.toFixed(2).replace('.', ',')}` }

// ─── Printer helpers ──────────────────────────────────────────

function makePrinter(ip: string, port: number, cols: number, ifaceOverride?: string | null) {
  return new ThermalPrinter.ThermalPrinter({
    type: ThermalPrinter.types.EPSON,
    interface: ifaceOverride ?? `tcp://${ip}:${port}`,
    width: cols,
    characterSet: ThermalPrinter.CharacterSet.PC860_PORTUGUESE,
  })
}

// ─── Receipt / fiche print ────────────────────────────────────

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

const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro', debit: 'Cartao Debito', credit: 'Cartao Credito',
  pix: 'Pix', voucher: 'Voucher', conta_receita: 'Conta Receita',
}

async function printReceipt(payload: PrintPayload): Promise<void> {
  const printer = makePrinter(PRINTER_IP, PRINTER_PORT, CHAR_COLS, PRINTER_IFACE)

  const isConnected = await printer.isPrinterConnected()
  if (!isConnected) throw new Error(`Impressora offline: ${PRINTER_IFACE ?? `${PRINTER_IP}:${PRINTER_PORT}`}`)

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

  if (payload.discount > 0) {
    printer.leftRight('Desconto', `-${fmt(payload.discount)}`)
  }
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
  await printer.execute()
  printer.clear()
}

// ─── Kitchen comanda print ────────────────────────────────────

interface KitchenPayload {
  tableNumber: number | null
  saleType: string
  operatorName: string
  printedAt: string
  items: { qty: number; name: string; notes: string | null }[]
}

async function printKitchen(payload: KitchenPayload): Promise<void> {
  const printer = makePrinter(KITCHEN_IP, KITCHEN_PORT, 48, KITCHEN_IFACE)

  const isConnected = await printer.isPrinterConnected()
  if (!isConnected) throw new Error(`Impressora cozinha offline: ${KITCHEN_IFACE ?? `${KITCHEN_IP}:${KITCHEN_PORT}`}`)

  const label = payload.tableNumber
    ? `Mesa: ${payload.tableNumber}`
    : payload.saleType === 'counter' ? 'Balcao' : 'Delivery'

  const time = new Date(payload.printedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  })

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

// ─── Polling loop ─────────────────────────────────────────────

interface PrintJob {
  id: string
  type: string
  payload: string
  status: string
}

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

async function processJob(job: PrintJob): Promise<void> {
  const payload = JSON.parse(job.payload)
  if (job.type === 'kitchen') {
    await printKitchen(payload as KitchenPayload)
  } else {
    await printReceipt(payload as PrintPayload)
  }
}

async function poll(): Promise<void> {
  let jobs: PrintJob[]
  try {
    jobs = await fetchPending()
  } catch (err) {
    console.error('[agent] Erro ao buscar jobs:', (err as Error).message)
    return
  }

  for (const job of jobs) {
    try {
      await processJob(job)
      await markJob(job.id, 'printed')
      console.log(`[agent] ✓ Job ${job.id} (${job.type}) impresso`)
    } catch (err) {
      console.error(`[agent] ✗ Job ${job.id} falhou:`, (err as Error).message)
      // deixa pendente para tentar no próximo ciclo
    }
  }
}

// ─── Start ────────────────────────────────────────────────────

console.log(`[agent] Iniciado — API: ${API_URL}`)
console.log(`[agent] Impressora recibo: ${PRINTER_IFACE ?? `${PRINTER_IP}:${PRINTER_PORT}`}`)
console.log(`[agent] Impressora cozinha: ${KITCHEN_IFACE ?? `${KITCHEN_IP}:${KITCHEN_PORT}`}`)
console.log(`[agent] Polling a cada ${POLL_MS}ms\n`)

void poll()
setInterval(() => void poll(), POLL_MS)
