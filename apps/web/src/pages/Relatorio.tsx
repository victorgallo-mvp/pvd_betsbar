import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BarChart3, TrendingUp, Package, CreditCard, User } from 'lucide-react'
import { api } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────

interface Summary {
  count: number
  total: number
  avgTicket: number
  byType: { type: string; count: number; total: number }[]
}
interface ByMethod  { method: string; count: number; total: number; pct: number }
interface ByProduct { productId: string; name: string; qty: number; revenue: number; pct: number }
interface ByOperator{ operatorId: string; name: string; count: number; total: number }

// ─── Helpers ──────────────────────────────────────────────────

function fmtBRL(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtPct(n: number)  { return (n * 100).toFixed(1) + '%' }

const TYPE_LABELS: Record<string, string> = { table: 'Mesa', counter: 'Balcão', delivery: 'Delivery' }
const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro', debit: 'Cartão Débito', credit: 'Cartão Crédito',
  pix: 'Pix', voucher: 'Voucher', conta_receita: 'Conta Receita',
}
const METHOD_COLORS: Record<string, string> = {
  cash: 'bg-emerald-500', debit: 'bg-blue-500', credit: 'bg-rose-500',
  pix: 'bg-emerald-400', voucher: 'bg-purple-500', conta_receita: 'bg-orange-500',
}

// Period presets
function todayRange() {
  const d = new Date()
  return { from: fmt(d), to: fmt(d) }
}
function fmt(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const PRESETS = [
  { id: 'today',     label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'week',      label: 'Esta semana' },
  { id: 'month',     label: 'Este mês' },
  { id: 'custom',    label: 'Personalizado' },
] as const
type Preset = typeof PRESETS[number]['id']

function computeRange(preset: Preset, custom: { from: string; to: string }) {
  const now = new Date()
  if (preset === 'today') return todayRange()
  if (preset === 'yesterday') {
    const d = new Date(now); d.setDate(d.getDate() - 1)
    return { from: fmt(d), to: fmt(d) }
  }
  if (preset === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay()) // Sunday
    return { from: fmt(d), to: fmt(now) }
  }
  if (preset === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1)
    return { from: fmt(d), to: fmt(now) }
  }
  return custom
}

// ─── Sub-tabs ─────────────────────────────────────────────────

function SummaryTab({ summary }: { summary: Summary | null }) {
  if (!summary) return <Empty />
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Vendas" value={String(summary.count)} sub="transações" />
        <MetricCard label="Total" value={fmtBRL(summary.total)} sub="receita bruta" accent />
        <MetricCard label="Ticket Médio" value={fmtBRL(summary.avgTicket)} sub="por venda" />
      </div>
      {summary.byType.length > 0 && (
        <Section title="Por tipo de venda">
          {summary.byType.map(t => (
            <div key={t.type} className="flex justify-between items-center py-1.5 border-b border-slate-800">
              <span className="text-slate-300 text-sm">{TYPE_LABELS[t.type] ?? t.type}</span>
              <div className="flex gap-4 text-sm">
                <span className="text-slate-500">{t.count}×</span>
                <span className="text-slate-200 font-semibold w-28 text-right">{fmtBRL(t.total)}</span>
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  )
}

function ByMethodTab({ data }: { data: ByMethod[] }) {
  if (!data.length) return <Empty />
  const max = Math.max(...data.map(d => d.total), 1)
  return (
    <div className="p-4 space-y-3">
      {data.map(d => (
        <div key={d.method} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-slate-300">{METHOD_LABELS[d.method] ?? d.method}</span>
            <div className="flex gap-3">
              <span className="text-slate-500">{d.count}× · {fmtPct(d.pct)}</span>
              <span className="text-slate-200 font-semibold w-24 text-right">{fmtBRL(d.total)}</span>
            </div>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${METHOD_COLORS[d.method] ?? 'bg-slate-500'}`}
              style={{ width: `${(d.total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function ByProductTab({ data }: { data: ByProduct[] }) {
  if (!data.length) return <Empty />
  return (
    <div className="p-4">
      <Section title="">
        {data.map((d, i) => (
          <div key={d.productId} className="flex items-center gap-3 py-1.5 border-b border-slate-800">
            <span className="text-slate-600 text-xs w-5 text-right shrink-0">{i + 1}</span>
            <span className="flex-1 text-sm text-slate-300 truncate">{d.name}</span>
            <span className="text-slate-500 text-xs shrink-0">{d.qty} un.</span>
            <span className="text-xs text-slate-500 shrink-0 w-10 text-right">{fmtPct(d.pct)}</span>
            <span className="text-emerald-400 font-semibold text-sm shrink-0 w-24 text-right">{fmtBRL(d.revenue)}</span>
          </div>
        ))}
      </Section>
    </div>
  )
}

function ByOperatorTab({ data }: { data: ByOperator[] }) {
  if (!data.length) return <Empty />
  return (
    <div className="p-4">
      <Section title="">
        {data.map(d => (
          <div key={d.operatorId} className="flex items-center gap-3 py-1.5 border-b border-slate-800">
            <span className="flex-1 text-sm text-slate-300">{d.name}</span>
            <span className="text-slate-500 text-sm">{d.count} vendas</span>
            <span className="text-slate-200 font-semibold text-sm w-28 text-right">{fmtBRL(d.total)}</span>
          </div>
        ))}
      </Section>
    </div>
  )
}

function Empty() {
  return <div className="flex items-center justify-center h-32 text-slate-600 text-sm">Nenhum dado no período selecionado.</div>
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {title && <div className="px-4 py-2 bg-slate-700/50 text-xs font-semibold text-slate-400 uppercase tracking-wide">{title}</div>}
      <div className="px-4 py-2">{children}</div>
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-3 text-center">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${accent ? 'text-emerald-400' : 'text-slate-100'}`}>{value}</div>
      <div className="text-xs text-slate-600 mt-0.5">{sub}</div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

type ReportTab = 'resumo' | 'metodos' | 'produtos' | 'operadores'

const REPORT_TABS: { id: ReportTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'resumo',     label: 'Resumo',    icon: TrendingUp },
  { id: 'metodos',    label: 'Pagamento', icon: CreditCard },
  { id: 'produtos',   label: 'Produtos',  icon: Package },
  { id: 'operadores', label: 'Operadores',icon: User },
]

export default function Relatorio() {
  const navigate = useNavigate()
  const [preset, setPreset] = useState<Preset>('today')
  const [custom, setCustom] = useState(todayRange())
  const [reportTab, setReportTab] = useState<ReportTab>('resumo')
  const [loading, setLoading] = useState(false)

  const [summary,     setSummary]     = useState<Summary | null>(null)
  const [byMethod,    setByMethod]    = useState<ByMethod[]>([])
  const [byProduct,   setByProduct]   = useState<ByProduct[]>([])
  const [byOperator,  setByOperator]  = useState<ByOperator[]>([])

  const range = computeRange(preset, custom)
  const qs = `?from=${range.from}&to=${range.to}`

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [s, m, p, o] = await Promise.all([
        api.get<Summary>(`/reports/summary${qs}`),
        api.get<ByMethod[]>(`/reports/by-method${qs}`),
        api.get<ByProduct[]>(`/reports/by-product${qs}`),
        api.get<ByOperator[]>(`/reports/by-operator${qs}`),
      ])
      setSummary(s); setByMethod(m); setByProduct(p); setByOperator(o)
    } finally {
      setLoading(false)
    }
  }, [qs]) // eslint-disable-line

  useEffect(() => { loadAll() }, [loadAll])

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200 touch-btn">
          <ArrowLeft size={22} />
        </button>
        <BarChart3 size={18} className="text-slate-400" />
        <span className="text-slate-200 font-medium flex-1">Relatório</span>
        {loading && <span className="text-xs text-slate-500 animate-pulse">Carregando...</span>}
      </div>

      {/* Period selector */}
      <div className="bg-slate-800 border-b border-slate-700 px-3 py-2 shrink-0">
        <div className="flex gap-1.5 flex-wrap">
          {PRESETS.map(p => (
            <button key={p.id} onClick={() => setPreset(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium touch-btn transition-colors ${
                preset === p.id ? 'bg-emerald-700 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex gap-2 mt-2 items-center">
            <input type="date" value={custom.from} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none user-select-text" />
            <span className="text-slate-500 text-xs">até</span>
            <input type="date" value={custom.to} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none user-select-text" />
          </div>
        )}
        <div className="text-xs text-slate-600 mt-1">
          {range.from === range.to ? range.from : `${range.from} → ${range.to}`}
        </div>
      </div>

      {/* Report sub-tabs */}
      <div className="flex bg-slate-800 border-b border-slate-700 shrink-0">
        {REPORT_TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setReportTab(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs font-medium touch-btn transition-colors ${
              reportTab === id ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {reportTab === 'resumo'     && <SummaryTab summary={summary} />}
        {reportTab === 'metodos'    && <ByMethodTab data={byMethod} />}
        {reportTab === 'produtos'   && <ByProductTab data={byProduct} />}
        {reportTab === 'operadores' && <ByOperatorTab data={byOperator} />}
      </div>
    </div>
  )
}
