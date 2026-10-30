import { prisma } from '../lib/prisma.js'
// @ts-ignore
import ThermalPrinter from 'node-thermal-printer'
import { readConfig } from '../appConfig.js'
import { computeShares } from '@pdv/shared'


const AGENT_MODE = process.env.AGENT_MODE === 'true'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro', debit: 'Cartao Debito', credit: 'Cartao Credito',
  pix: 'Pix', voucher: 'Voucher', conta_receita: 'Conta Receita',
}

// Linhas de pagamento da CONTA (pedir conta) sem mexer no agente: o modelo
// imprime o texto de `method` quando não é uma forma conhecida. Então cada
// pagamento vira "Pago Pix - Victor 21:30" e a última linha é o saldo.
function billPaymentLines(
  payments: { method: string; amount: number; guest?: string | null; paidAt: Date }[],
  totalCents: number,
  who: string | null,
): { method: string; amount: number; guest?: string | null }[] {
  const lines = payments.map((p) => {
    const hora = p.paidAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    return { method: `Pago ${METHOD_LABELS[p.method] ?? p.method}${p.guest ? ' - ' + p.guest : ''} ${hora}`, amount: p.amount, guest: p.guest ?? null }
  })
  const paidCents = payments.reduce((s, p) => s + Math.round(p.amount * 100), 0)
  const dueCents = Math.max(0, totalCents - paidCents)
  if (payments.length === 0) return lines
  lines.push(dueCents > 0
    ? { method: who ? `FALTA PAGAR (${who})` : 'FALTA PAGAR', amount: dueCents / 100, guest: null }
    : { method: who ? `QUITADO (${who})` : 'QUITADO', amount: 0, guest: null })
  return lines
}

function fmt(n: number) { return `R$ ${n.toFixed(2).replace('.', ',')}` }

// Build an ESC/POS receipt using node-thermal-printer and send it to the
// configured network printer. Falls through to 'html' gracefully if not set.
async function sendThermal(payload: PrintPayload): Promise<void> {
  // In AGENT_MODE the local print agent handles all printing via DB jobs
  if (AGENT_MODE) return
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
  // guest: nome da pessoa dona do item (null = mesa). Agente antigo ignora.
  items: { name: string; qty: number; unitPrice: number; subtotal: number; guest?: string | null }[]
  subtotal: number
  discount: number
  total: number
  payments: { method: string; amount: number; guest?: string | null }[]
  troco: number
  // Conta de uma pessoa só (divisão por pessoa). Ausente = mesa toda.
  guestName?: string | null
  // Resumo por pessoa quando a mesa tem pessoas (conta da mesa toda)
  guestSummary?: { name: string; total: number; paid: number }[]
}

export const PrintService = {
  // Creates a fiche/receipt print job — only allowed after sale is paid.
  // Critical anti-fraud rule: no printing before money is received.
  async createFicheJob(saleId: string) {
    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: {
        items: { include: { product: true, guest: true }, where: { cancelled: false } },
        payments: { include: { guest: true } },
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
        guest: i.guest?.name ?? null,
      })),
      subtotal: Number(sale.subtotal),
      discount: Number(sale.discount),
      total: Number(sale.total),
      payments: sale.payments.map((p) => ({ method: p.method, amount: Number(p.amount), guest: p.guest?.name ?? null })),
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

  // Creates a bill job when "pedir conta" is called — prints before payment.
  // Used for tables: flow is request-bill → print → payment (not after payment).
  // guestId: imprime só a conta daquela pessoa (itens dela). Itens da mesa não
  // são rateados: ficam na conta da mesa — ver computeShares em @pdv/shared.
  async createBillJob(saleId: string, guestId: string | null = null) {
    const sale = await prisma.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: {
        items: { include: { product: true, guest: true }, where: { cancelled: false } },
        payments: { include: { guest: true } },
        operator: true,
        table: true,
        guests: { orderBy: { position: 'asc' } },
      },
    })

    const guest = guestId ? sale.guests.find((g) => g.id === guestId) : null
    if (guestId && !guest) throw new Error('Pessoa não encontrada nesta mesa')

    const shares = computeShares({
      items: sale.items.map((i) => ({ guestId: i.guestId ?? null, qty: i.qty, unitPrice: Number(i.unitPrice), cancelled: i.cancelled })),
      payments: sale.payments.map((p) => ({ guestId: p.guestId ?? null, amount: Number(p.amount) })),
      guests: sale.guests.map((g) => ({ id: g.id, name: g.name, position: g.position })),
    })

    let payload: PrintPayload
    if (guest) {
      const share = shares.guests.find((g) => g.guestId === guest.id)!
      const own = sale.items.filter((i) => i.guestId === guest.id)
      const items: PrintPayload['items'] = own.map((i) => ({
        name: i.product.name, qty: i.qty, unitPrice: Number(i.unitPrice), subtotal: Number(i.unitPrice) * i.qty, guest: guest.name,
      }))
      payload = {
        saleId: sale.id,
        saleType: sale.type,
        date: new Date().toISOString(),
        operatorName: sale.operator.name,
        tableNumber: sale.table?.number ?? null,
        customerName: sale.customerName ?? null,
        customerAddress: sale.customerAddress ?? null,
        items,
        subtotal: share.totalCents / 100,
        discount: 0,
        total: share.totalCents / 100,
        payments: billPaymentLines(
          sale.payments.filter((p) => p.guestId === guest.id).map((p) => ({ method: p.method, amount: Number(p.amount), guest: guest.name, paidAt: p.paidAt })),
          share.totalCents, guest.name,
        ),
        troco: 0,
        guestName: guest.name,
      }
    } else {
      payload = {
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
          guest: i.guest?.name ?? null,
        })),
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        total: Number(sale.total),
        // Pagamentos parciais já feitos na mesa — aparecem no papel como extrato
        // abaixo do TOTAL cheio: "Pago Pix - Victor 21:30" + "FALTA PAGAR".
        payments: billPaymentLines(
          sale.payments.map((p) => ({ method: p.method, amount: Number(p.amount), guest: p.guest?.name ?? null, paidAt: p.paidAt })),
          Math.round(Number(sale.total) * 100), null,
        ),
        troco: 0,
        ...(sale.guests.length > 0 && {
          guestSummary: [
            ...shares.guests.map((g) => ({ name: g.name, total: g.totalCents / 100, paid: g.paidCents / 100 })),
            ...(shares.sharedCents > 0 ? [{ name: 'Mesa (compartilhado)', total: shares.sharedCents / 100, paid: shares.unassignedPaidCents / 100 }] : []),
          ],
        }),
      }
    }

    if (!AGENT_MODE) {
      const cfg = readConfig()
      if (cfg.printer.type === 'network') {
        try { await sendThermal(payload) } catch { /* agent will retry */ }
      }
    }

    return prisma.printJob.create({
      data: {
        saleId,
        type: 'receipt',
        status: 'pending',
        triggerEvent: 'bill_requested',
        payload: JSON.stringify(payload),
      },
    })
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
