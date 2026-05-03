import { PrismaClient } from '@prisma/client'
// @ts-ignore
import ThermalPrinter from 'node-thermal-printer'
import { readConfig } from '../appConfig.js'

const prisma = new PrismaClient()

const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro', debit: 'Cartao Debito', credit: 'Cartao Credito',
  pix: 'Pix', voucher: 'Voucher', conta_receita: 'Conta Receita',
}

function fmt(n: number) { return `R$ ${n.toFixed(2).replace('.', ',')}` }

// Build an ESC/POS receipt using node-thermal-printer and send it to the
// configured network printer. Falls through to 'html' gracefully if not set.
async function sendThermal(payload: PrintPayload): Promise<void> {
  const cfg = readConfig()
  if (cfg.printer.type !== 'network') return

  const printer = new ThermalPrinter.ThermalPrinter({
    type: ThermalPrinter.types.EPSON,
    interface: `tcp://${cfg.printer.ip}:${cfg.printer.port}`,
    width: cfg.printer.width === 58 ? 32 : 48,
    characterSet: ThermalPrinter.CharacterSet.PC860_PORTUGUESE,
  })

  const isConnected = await printer.isPrinterConnected()
  if (!isConnected) throw new Error(`Impressora não encontrada em ${cfg.printer.ip}:${cfg.printer.port}`)

  printer.alignCenter()
  printer.setTextDoubleHeight()
  printer.bold(true)
  printer.println(cfg.establishment.name)
  printer.bold(false)
  printer.setTextNormal()
  if (cfg.establishment.address) printer.println(cfg.establishment.address)
  if (cfg.establishment.cnpj) printer.println(`CNPJ: ${cfg.establishment.cnpj}`)
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

// ─────────────────────────────────────────────────────────────

interface PrintPayload {
  saleId: string
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

export const PrintService = {
  // Creates a fiche/receipt print job — only allowed after sale is paid.
  // Critical anti-fraud rule: no printing before money is received.
  async createFicheJob(saleId: string) {
    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: {
        items: { include: { product: true }, where: { cancelled: false } },
        payments: true,
        operator: true,
        table: true,
      },
    })

    if (sale.status !== 'paid') {
      throw new Error('Impressão de ficha só é permitida após o recebimento.')
    }

    const totalPaid = sale.payments.reduce((s, p) => s + Number(p.amount), 0)
    const troco = sale.payments.some((p) => p.method === 'cash')
      ? Math.max(0, totalPaid - Number(sale.total))
      : 0

    const payload: PrintPayload = {
      saleId: sale.id,
      saleType: sale.type,
      date: new Date().toISOString(),
      operatorName: sale.operator.name,
      tableNumber: sale.table?.number ?? null,
      customerName: sale.customerName ?? null,
      customerAddress: sale.customerAddress ?? null,
      items: sale.items.map((i) => ({
        name: i.product.name,
        qty: i.qty,
        unitPrice: Number(i.unitPrice),
        subtotal: Number(i.unitPrice) * i.qty,
      })),
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      total: Number(sale.total),
      payments: sale.payments.map((p) => ({ method: p.method, amount: Number(p.amount) })),
      troco,
    }

    // If network printer is configured, send immediately
    const cfg = readConfig()
    let thermalError: string | null = null
    if (cfg.printer.type === 'network') {
      try {
        await sendThermal(payload)
      } catch (err) {
        thermalError = (err as Error).message
      }
    }

    const job = await prisma.printJob.create({
      data: {
        saleId,
        type: sale.type === 'table' ? 'receipt' : 'fiche',
        status: 'pending',
        triggerEvent: 'payment_confirmed',
        payload: JSON.stringify(payload),
      },
    })

    return { ...job, thermalError }
  },

  async markJob(jobId: string, action: 'printed' | 'skipped') {
    return prisma.printJob.update({
      where: { id: jobId },
      data: { status: action, printedAt: action === 'printed' ? new Date() : null },
    })
  },

  async getJob(jobId: string) {
    return prisma.printJob.findUniqueOrThrow({ where: { id: jobId } })
  },

  async testPrint() {
    const cfg = readConfig()
    if (cfg.printer.type !== 'network') {
      return { ok: true, message: 'Impressora configurada como HTML — teste via navegador.' }
    }

    const testPayload: PrintPayload = {
      saleId: 'test', saleType: 'counter',
      date: new Date().toISOString(),
      operatorName: 'Teste',
      tableNumber: null, customerName: null, customerAddress: null,
      items: [{ name: 'Produto Teste', qty: 1, unitPrice: 10, subtotal: 10 }],
      subtotal: 10, discount: 0, total: 10,
      payments: [{ method: 'cash', amount: 10 }],
      troco: 0,
    }

    await sendThermal(testPayload)
    return { ok: true, message: 'Página de teste enviada com sucesso.' }
  },
}
