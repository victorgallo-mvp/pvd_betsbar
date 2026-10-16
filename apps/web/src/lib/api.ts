import { track, getDeviceId, getDiagContext } from './diag'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

// Cabeçalhos de diagnóstico: identificam o aparelho, o operador e a venda que a
// tela está exibindo no momento da requisição (ver apps/api/src/lib/reqContext.ts).
function diagHeaders(): Record<string, string> {
  const c = getDiagContext()
  const h: Record<string, string> = { 'X-Device-Id': getDeviceId(), 'X-Route': location.pathname.slice(0, 120) }
  if (c.operatorId) h['X-Operator-Id'] = c.operatorId
  if (c.screenSaleId) h['X-Screen-Sale'] = c.screenSaleId
  return h
}

function classify(err: unknown): string {
  const e = err as { name?: string; message?: string }
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'timeout'
  if (e instanceof TypeError) return 'network' // fetch falhou antes de resposta (sem rede, DNS, CORS)
  return 'unknown'
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const started = performance.now()
  const method = options?.method ?? 'GET'
  const log = (extra: Record<string, unknown>) =>
    track('request', { method, path: path.slice(0, 120), ms: Math.round(performance.now() - started), ...extra })

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      // só declara JSON quando há corpo — DELETE/GET sem body + Content-Type
      // vazio faz o Fastify rejeitar com FST_ERR_CTP_EMPTY_JSON_BODY (400)
      headers: { ...diagHeaders(), ...(options?.body ? { 'Content-Type': 'application/json' } : {}) },
      // Sem timeout, uma API travada deixa a requisição pendurada para sempre
      signal: AbortSignal.timeout(15_000),
      ...options,
    })
  } catch (err) {
    // Só registra; o erro segue exatamente como antes
    log({ ok: false, error: classify(err), detail: String((err as Error)?.message ?? err).slice(0, 200) })
    throw err
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    log({ ok: false, status: res.status, error: (body as { error?: unknown }).error ?? null })
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }

  log({ ok: true, status: res.status })
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
