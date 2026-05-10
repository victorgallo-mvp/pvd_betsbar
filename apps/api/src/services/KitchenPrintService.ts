import { PrismaClient } from '@prisma/client'
// @ts-ignore
import ThermalPrinter from 'node-thermal-printer'
import { readConfig } from '../appConfig.js'

const prisma = new PrismaClient()

const MOCK = process.env.MOCK_PRINTER === 'true'
const AGENT_MODE = process.env.AGENT_MODE === 'true'

interface KitchenItem {
  qty: number
  name: string
  notes: string | null
}

interface KitchenPayload {
  saleId: string
  tableNumber: number | null
  saleType: string
  operatorName: string
  printedAt: string
  items: KitchenItem[]
}

function buildLabel(payload: KitchenPayload): string {
  if (payload.tableNumber) return `Mesa: ${payload.tableNumber}`
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
    for (const item of payload.items) {
      console.log(`${item.qty}x  ${item.name.toUpperCase()}`)
      if (item.notes) console.log(`    Obs: ${item.notes}`)
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
  printer.println(`Garcao: ${payload.operatorName}   ${time}`)
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

export const KitchenPrintService = {
  async printOrder(saleId: string): Promise<{ printed: number; queued: number }> {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        operator: true,
        table: true,
        items: {
          where: { sentToProduction: false, cancelled: false },
          include: { product: true },
        },
      },
    })

    if (!sale || sale.items.length === 0) return { printed: 0, queued: 0 }

    const payload: KitchenPayload = {
      saleId: sale.id,
      tableNumber: sale.table?.number ?? null,
      saleType: sale.type,
      operatorName: sale.operator.name,
      printedAt: new Date().toISOString(),
      items: sale.items.map((i) => ({
        qty: i.qty,
        name: i.product.name,
        notes: i.notes,
      })),
    }

    // Mark items as sent to production before attempting print.
    // This ensures the flow is never blocked by a printer failure.
    await prisma.saleItem.updateMany({
      where: { saleId, sentToProduction: false, cancelled: false },
      data: { sentToProduction: true },
    })

    // In AGENT_MODE the local print agent handles all printing — skip TCP attempt
    if (!AGENT_MODE) {
      try {
        await sendToKitchenPrinter(payload)
        return { printed: sale.items.length, queued: 0 }
      } catch (err) {
        console.error('[KitchenPrint] Falha ao imprimir, adicionando à fila:', (err as Error).message)
      }
    }

    await prisma.printJob.create({
      data: {
        saleId,
        type: 'kitchen',
        status: 'pending',
        triggerEvent: 'item_added',
        payload: JSON.stringify(payload),
      },
    })

    return { printed: 0, queued: sale.items.length }
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
