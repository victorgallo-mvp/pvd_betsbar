import { prisma } from '../lib/prisma.js'
// @ts-ignore
import ThermalPrinter from 'node-thermal-printer'
import { readConfig } from '../appConfig.js'
import { Diag } from './DiagService.js'
import { ctx } from '../lib/reqContext.js'
import { buildCounterTicket } from './SaleService.js'


const MOCK = process.env.MOCK_PRINTER === 'true'
const AGENT_MODE = process.env.AGENT_MODE === 'true'

interface KitchenItem {
  qty: number
  name: string
  notes: string | null
  guest?: string | null // pessoa da mesa (divisão por pessoa); null = mesa
}

// Agrupa itens por pessoa mantendo a ordem: itens da mesa primeiro, depois cada pessoa
function groupByGuest(items: KitchenItem[]): { guest: string | null; items: KitchenItem[] }[] {
  const groups: { guest: string | null; items: KitchenItem[] }[] = []
  for (const it of items) {
    const key = it.guest ?? null
    let g = groups.find((x) => x.guest === key)
    if (!g) { g = { guest: key, items: [] }; groups.push(g) }
    g.items.push(it)
  }
  groups.sort((a, b) => (a.guest === null ? -1 : b.guest === null ? 1 : 0))
  return groups
}

interface KitchenPayload {
  saleId: string
  tableNumber: number | null
  customerName: string | null
  saleType: string
  operatorName: string
  printedAt: string
  items: KitchenItem[]
}

function buildLabel(payload: KitchenPayload): string {
  if (payload.tableNumber) {
    return payload.customerName ? payload.customerName : `Mesa: ${payload.tableNumber}`
  }
  if (payload.saleType === 'counter') return 'Balcao'
  return 'Delivery'
}

async function sendToKitchenPrinter(payload: KitchenPayload): Promise<void> {
  if (MOCK) {
    const time = new Date(payload.printedAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    console.log('\n================================')
    console.log('        COMANDA - COZINHA')
    console.log('================================')
    console.log(`${buildLabel(payload).padEnd(16)} Garcao: ${payload.operatorName}`)
    console.log(`Hora: ${time}`)
    console.log('--------------------------------')
    const hasGuests = payload.items.some((i) => i.guest)
    for (const group of groupByGuest(payload.items)) {
      if (hasGuests) console.log(`[ ${(group.guest ?? 'MESA').toUpperCase()} ]`)
      for (const item of group.items) {
        console.log(`${item.qty}x  ${item.name.toUpperCase()}`)
        if (item.notes) console.log(`    Obs: ${item.notes}`)
      }
    }
    console.log('================================\n')
    return
  }

  const cfg = readConfig()
  if (!cfg.kitchenPrinter.enabled || !cfg.kitchenPrinter.ip) {
    throw new Error('Impressora de cozinha não habilitada')
  }

  const printer = new ThermalPrinter.ThermalPrinter({
    type: ThermalPrinter.types.EPSON,
    interface: `tcp://${cfg.kitchenPrinter.ip}:${cfg.kitchenPrinter.port}`,
    width: 48,
    characterSet: ThermalPrinter.CharacterSet.PC860_PORTUGUESE,
  })

  const isConnected = await printer.isPrinterConnected()
  if (!isConnected) {
    throw new Error(
      `Impressora cozinha offline: ${cfg.kitchenPrinter.ip}:${cfg.kitchenPrinter.port}`,
    )
  }

  const time = new Date(payload.printedAt).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
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
  printer.println(buildLabel(payload))
  printer.bold(false)
  if (payload.tableNumber && payload.customerName) printer.println(`Mesa: ${payload.tableNumber}`)
  printer.println(`Garcao: ${payload.operatorName}   ${time}`)
  printer.drawLine()

  const hasGuests = payload.items.some((i) => i.guest)
  for (const group of groupByGuest(payload.items)) {
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

export const KitchenPrintService = {
  async printOrder(saleId: string): Promise<{ printed: number; queued: number }> {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        operator: true,
        table: true,
        items: {
          where: { sentToProduction: false, cancelled: false },
          include: { product: true, guest: true },
        },
      },
    })

    if (!sale) return { printed: 0, queued: 0 }

    const tableNumber = sale.table?.number ?? null
    const readIds = sale.items.map((i) => i.id)

    // Garçom que está lançando (aparelho), para o cabeçalho dos tickets
    const actorId = ctx()?.operatorId
    const actor = actorId ? await prisma.user.findUnique({ where: { id: actorId }, select: { name: true } }) : null
    const operatorName = actor?.name ?? sale.operator.name

    // Ticket de pedido no balcão (bebidas): job tipo 'receipt' que o executável já imprime
    const counterItems = readConfig().features.counterTickets ? sale.items.filter((i) => i.product.sendToCounter) : []
    const createCounterJob = () => prisma.printJob.create({
      data: {
        saleId,
        type: 'receipt',
        status: 'pending',
        triggerEvent: 'counter_order',
        payload: JSON.stringify(buildCounterTicket({
          saleId, tableNumber, customerName: sale.customerName, saleType: sale.type, operatorName,
          items: counterItems.map((i) => ({ qty: i.qty, name: i.product.name, unitPrice: Number(i.unitPrice), guest: i.guest?.name ?? null })),
        })),
      },
    })
    // Diagnóstico: itens marcados como enviados devem ser exatamente os lidos. Se a
    // contagem diferir, outro aparelho adicionou/alterou item entre a leitura e a
    // marcação, e esse item nunca vai sair no ticket.
    const logLaunch = (marked: number, jobId: string | null, kitchen: number, counterJobId: string | null = null) => {
      Diag.log({
        type: 'sale.launched',
        saleId,
        tableNumber,
        data: {
          itemsRead: readIds.length, kitchenItems: kitchen, marked, jobId, customerName: sale.customerName,
          counterItems: counterItems.length, counterJobId, operatorName,
          items: sale.items.map((i) => ({ id: i.id, qty: i.qty, name: i.product.name, kitchen: i.product.sendToKitchen, guest: i.guest?.name ?? null })),
        },
      })
      if (marked !== readIds.length) {
        Diag.log({ type: 'conflict.launch_marked_unread', saleId, tableNumber, data: { itemsRead: readIds.length, marked, readIds } })
      }
    }

    // Only send items whose product is flagged for kitchen printing
    const kitchenItems = sale.items.filter((i) => i.product.sendToKitchen)
    if (kitchenItems.length === 0) {
      // No kitchen items (e.g. only beverages) — still mark all pending as sent
      if (counterItems.length > 0) {
        const [r, cj] = await prisma.$transaction([
          prisma.saleItem.updateMany({ where: { saleId, sentToProduction: false, cancelled: false }, data: { sentToProduction: true } }),
          createCounterJob(),
        ])
        logLaunch(r.count, null, 0, cj.id)
        return { printed: 0, queued: counterItems.length }
      }
      const r = await prisma.saleItem.updateMany({
        where: { saleId, sentToProduction: false, cancelled: false },
        data: { sentToProduction: true },
      })
      logLaunch(r.count, null, 0)
      return { printed: 0, queued: 0 }
    }

    const payload: KitchenPayload = {
      saleId: sale.id,
      tableNumber: sale.table?.number ?? null,
      customerName: sale.customerName ?? null,
      saleType: sale.type,
      operatorName,
      printedAt: new Date().toISOString(),
      items: [
        ...(sale.customerName ? [{ qty: 1, name: `CLIENTE: ${sale.customerName}`, notes: null }] : []),
        ...kitchenItems.map((i) => ({
          qty: i.qty,
          name: i.product.name,
          notes: i.notes,
          guest: i.guest?.name ?? null,
        })),
      ],
    }

    const markSent = () => prisma.saleItem.updateMany({
      where: { saleId, sentToProduction: false, cancelled: false },
      data: { sentToProduction: true },
    })

    const createJob = () => prisma.printJob.create({
      data: {
        saleId,
        type: 'kitchen',
        status: 'pending',
        triggerEvent: 'item_added',
        payload: JSON.stringify(payload),
      },
    })

    // In AGENT_MODE the local print agent handles all printing — skip TCP attempt.
    // Atômico: nunca marca itens como enviados sem o job correspondente existir.
    if (AGENT_MODE) {
      if (counterItems.length > 0) {
        const [marked, job, cj] = await prisma.$transaction([markSent(), createJob(), createCounterJob()])
        logLaunch(marked.count, job.id, kitchenItems.length, cj.id)
        return { printed: 0, queued: kitchenItems.length + counterItems.length }
      }
      const [marked, job] = await prisma.$transaction([markSent(), createJob()])
      logLaunch(marked.count, job.id, kitchenItems.length)
      return { printed: 0, queued: kitchenItems.length }
    }

    // Fora do modo agente, o ticket de balcão vai para a fila do mesmo jeito
    const counterJob = counterItems.length > 0 ? await createCounterJob() : null

    // Mark ALL pending items as sent to production (including non-kitchen ones).
    // This ensures the flow is never blocked by a printer failure.
    const marked = await markSent()

    try {
      await sendToKitchenPrinter(payload)
      logLaunch(marked.count, null, kitchenItems.length, counterJob?.id ?? null)
      return { printed: kitchenItems.length, queued: counterItems.length }
    } catch (err) {
      console.error('[KitchenPrint] Falha ao imprimir, adicionando à fila:', (err as Error).message)
    }

    const job = await createJob()
    logLaunch(marked.count, job.id, kitchenItems.length, counterJob?.id ?? null)

    return { printed: 0, queued: kitchenItems.length + counterItems.length }
  },

  async testPrint(): Promise<{ ok: boolean; message: string }> {
    const cfg = readConfig()
    if (!cfg.kitchenPrinter.enabled || !cfg.kitchenPrinter.ip) {
      return { ok: false, message: 'Impressora de cozinha não habilitada.' }
    }
    const testPayload: KitchenPayload = {
      saleId: 'test',
      tableNumber: null,
      customerName: null,
      saleType: 'counter',
      operatorName: 'Teste',
      printedAt: new Date().toISOString(),
      items: [{ qty: 1, name: 'ITEM TESTE', notes: null }],
    }
    await sendToKitchenPrinter(testPayload)
    return { ok: true, message: 'Página de teste enviada para impressora da cozinha.' }
  },

  async retryFailedJobs(): Promise<void> {
    const pending = await prisma.printJob.findMany({
      where: { type: 'kitchen', status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: 10,
    })

    for (const job of pending) {
      try {
        const payload = JSON.parse(job.payload) as KitchenPayload
        await sendToKitchenPrinter(payload)

        await prisma.printJob.update({
          where: { id: job.id },
          data: { status: 'printed', printedAt: new Date() },
        })

        console.log(`[KitchenPrint] Job ${job.id} reimpresso com sucesso`)
      } catch {
        // Impressora ainda offline — tenta no próximo ciclo
      }
    }
  },
}
