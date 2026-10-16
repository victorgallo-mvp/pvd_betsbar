#!/usr/bin/env node
// Relatório local do diário de diagnóstico.
//
// Uso:
//   node scripts/diag-report.mjs <API_URL> [data YYYY-MM-DD] [--device ID] [--sale ID] [--table N] [--raw]
// Ex.: node scripts/diag-report.mjs https://api-production-10fc7.up.railway.app 2026-10-18
//
// Lê GET /diag/events e GET /diag/summary e imprime: resumo, conflitos, requisições
// que falharam no celular, latência de impressão e linha do tempo por aparelho.

const [,, API, dateArg, ...rest] = process.argv
if (!API) { console.error('uso: diag-report.mjs <API_URL> [YYYY-MM-DD] [--device ID] [--sale ID] [--table N] [--raw]'); process.exit(1) }
const date = dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg) ? dateArg : new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const opt = (k) => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : undefined }
const raw = rest.includes('--raw')
const base = API.replace(/\/$/, '')
const since = `${date}T00:00:00-03:00`, until = `${date}T23:59:59.999-03:00`
const hm = (t) => new Date(new Date(t).getTime() - 3 * 3.6e6).toISOString().slice(11, 19)

const qs = new URLSearchParams({ since, until, limit: '10000' })
if (opt('--device')) qs.set('deviceId', opt('--device'))
if (opt('--sale')) qs.set('saleId', opt('--sale'))
if (opt('--table')) qs.set('tableNumber', opt('--table'))
const events = await (await fetch(`${base}/diag/events?${qs}`)).json()
if (!Array.isArray(events)) { console.error('resposta inesperada:', events); process.exit(1) }
if (raw) { for (const e of events) console.log(JSON.stringify(e)); process.exit(0) }

const summary = await (await fetch(`${base}/diag/summary?date=${date}`)).json().catch(() => null)
console.log(`# Diagnóstico ${date} — ${events.length} eventos${opt('--device') ? ` (aparelho ${opt('--device')})` : ''}${opt('--table') ? ` (mesa ${opt('--table')})` : ''}`)
if (summary?.byType) {
  console.log('\n## Por tipo'); for (const [k, v] of Object.entries(summary.byType).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(6)}  ${k}`)
  console.log('\n## Jobs de impressão'); for (const j of summary.printJobs ?? []) console.log(`  ${j.status}: ${j._count._all} (máx tentativas ${j._max.attempts ?? 0})`)
}

const conflicts = events.filter((e) => e.type.startsWith('conflict.'))
console.log(`\n## Conflitos: ${conflicts.length}`)
for (const e of conflicts) console.log(`  ${hm(e.createdAt)} ${e.type} mesa=${e.tableNumber ?? '-'} venda=${e.saleId?.slice(-6) ?? '-'} aparelho=${e.deviceId ?? '-'} ${JSON.stringify(e.data ?? {}).slice(0, 160)}`)

const failed = events.filter((e) => e.source === 'client' && (e.type === 'request' && e.data?.ok === false || /_failed$/.test(e.type) || e.type === 'js_error'))
console.log(`\n## Falhas no aparelho: ${failed.length}`)
const byDev = {}; for (const e of failed) (byDev[e.deviceId] ??= []).push(e)
for (const [d, list] of Object.entries(byDev)) {
  const kinds = {}; for (const e of list) { const k = e.data?.error ?? e.type; kinds[k] = (kinds[k] ?? 0) + 1 }
  console.log(`  ${d}: ${list.length} — ${Object.entries(kinds).map(([k, v]) => `${k}×${v}`).join(', ')}`)
}

const mismatches = events.filter((e) => e.data?.mismatch === true)
console.log(`\n## Tela mostrando outra venda ao montar/agir: ${mismatches.length}`)
for (const e of mismatches.slice(0, 40)) console.log(`  ${hm(e.createdAt)} ${e.type} url=${e.saleId?.slice(-6)} tela=${e.data?.shownSaleId?.slice(-6)} (mesa ${e.data?.shownTable ?? '-'}) aparelho=${e.deviceId}`)

const prints = events.filter((e) => e.type === 'print.printed')
if (prints.length) {
  const lat = prints.map((e) => e.data?.latencyMs ?? 0).sort((a, b) => a - b)
  const p = (q) => (lat[Math.floor(lat.length * q)] / 1000).toFixed(1)
  console.log(`\n## Impressão: ${prints.length} impressos, latência criação→impresso mediana ${p(0.5)}s p90 ${p(0.9)} máx ${(lat[lat.length - 1] / 1000).toFixed(1)}s; falhas ${events.filter((e) => e.type === 'print.failed').length}; ciclos sobrepostos ${events.filter((e) => e.type === 'agent.poll_overlap').length}`)
}

const devices = {}
for (const e of events) if (e.source === 'client') (devices[e.deviceId ?? '?'] ??= []).push(e)
console.log(`\n## Aparelhos: ${Object.keys(devices).length}`)
for (const [d, list] of Object.entries(devices)) {
  const ua = list.find((e) => e.type === 'app_start')?.data?.ua ?? ''
  const ops = [...new Set(list.map((e) => e.operatorId).filter(Boolean))]
  console.log(`  ${d}: ${list.length} eventos, ${hm(list[0].createdAt)}–${hm(list[list.length - 1].createdAt)}, operadores=${ops.length}, ws quedas=${list.filter((e) => e.type === 'ws' && e.data?.state === 'close').length} ${ua.slice(0, 60)}`)
}

if (opt('--device') || opt('--table') || opt('--sale')) {
  console.log('\n## Linha do tempo')
  for (const e of events) {
    if (e.type === 'request' && e.source === 'client' && e.data?.ok) continue
    const d = { ...e.data }; delete d.online
    console.log(`  ${hm(e.createdAt)} [${e.source}] ${e.type.padEnd(28)} mesa=${String(e.tableNumber ?? '-').padStart(2)} venda=${e.saleId?.slice(-6) ?? '-'} tela=${e.screenSaleId?.slice(-6) ?? '-'} ${e.route ?? ''} ${JSON.stringify(d).slice(0, 140)}`)
  }
} else {
  console.log('\nDica: --device ID, --table N ou --sale ID imprime a linha do tempo completa.')
}
