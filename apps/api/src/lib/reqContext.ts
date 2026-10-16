import { AsyncLocalStorage } from 'node:async_hooks'

// Contexto da requisição atual, preenchido pelo hook onRequest em index.ts a partir
// dos cabeçalhos que o front envia (ver apps/web/src/lib/api.ts). Permite que os
// serviços registrem eventos com aparelho/operador/tela sem mudar assinaturas.
export interface ReqContext {
  reqId?: string
  deviceId?: string
  operatorId?: string
  screenSaleId?: string
  route?: string
  ua?: string
  ip?: string
}

export const reqContext = new AsyncLocalStorage<ReqContext>()

export function ctx(): ReqContext {
  return reqContext.getStore() ?? {}
}
