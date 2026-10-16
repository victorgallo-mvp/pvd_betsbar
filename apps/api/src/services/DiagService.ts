import { prisma } from '../lib/prisma.js'
import { ctx } from '../lib/reqContext.js'

export interface DiagInput {
  source?: 'client' | 'api' | 'agent'
  type: string
  deviceId?: string | null
  operatorId?: string | null
  saleId?: string | null
  tableNumber?: number | null
  screenSaleId?: string | null
  route?: string | null
  data?: unknown
  clientTs?: Date | null
}

function toRow(e: DiagInput) {
  const c = ctx()
  return {
    source: e.source ?? 'api',
    type: e.type,
    deviceId: e.deviceId ?? c.deviceId ?? null,
    operatorId: e.operatorId ?? c.operatorId ?? null,
    saleId: e.saleId ?? null,
    tableNumber: e.tableNumber ?? null,
    screenSaleId: e.screenSaleId ?? c.screenSaleId ?? null,
    route: e.route ?? c.route ?? null,
    data: e.data === undefined ? null : JSON.stringify(e.data),
    clientTs: e.clientTs ?? null,
  }
}

// Registro é fire-and-forget: falha de diagnóstico nunca pode quebrar o fluxo de venda.
export const Diag = {
  log(e: DiagInput): void {
    prisma.diagEvent.create({ data: toRow(e) }).catch((err) => {
      console.error('[diag] falha ao gravar evento', e.type, (err as Error).message)
    })
  },

  async logMany(events: DiagInput[]): Promise<number> {
    if (events.length === 0) return 0
    const res = await prisma.diagEvent.createMany({ data: events.map(toRow) })
    return res.count
  },
}
