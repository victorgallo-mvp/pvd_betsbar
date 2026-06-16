import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ChevronDown, ChevronRight, Pencil, History } from 'lucide-react'
import { api } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────

interface HistPayment { id: string; method: string; amount: number; paidAt: string }
interface HistItem    { id: string; productName: string; qty: number; subtotal: number; cancelled: boolean }
interface HistSale {
  id: string
  tableNumber: number | null
  customerName: string | null
  operatorName: string
  openedAt: string
  closedAt: string | null
  total: number
  items: HistItem[]
  payments: HistPayment[]
}

// ── Helpers ───────────────────────────────────────────────────

function fmtBRL(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro', debit: 'Cartão Débito', credit: 'Cartão Crédito',
  pix: 'Pix', voucher: 'Voucher', conta_receita: 'Conta Receita',
}

// ── Edit Payment Modal ────────────────────────────────────────

function EditPaymentModal({ payment, onSave, onClose }: {
  payment: HistPayment
  onSave: (id: string, method: string) => Promise<void>
  onClose: () => void
}) {
  const [method, setMethod] = useState(payment.method)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (method === payment.method) { onClose(); return }
    setSaving(true)
    await onSave(payment.id, method)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-80 shadow-2xl border border-slate-700">
        <h2 className="text-lg font-bold text-slate-100 mb-1">Forma de pagamento</h2>
        <p className="text-slate-500 text-xs mb-4">{fmtBRL(payment.amount)}</p>
        <div className="space-y-2 mb-6">
          {Object.entries(METHOD_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setMethod(key)}
              className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium touch-btn transition-colors
                ${method === key ? 'bg-emerald-700 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-slate-700 text-slate-300 touch-btn">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold touch-btn disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function Historico() {
  const navigate = useNavigate()
  const today     = localDateStr(new Date())
  const yesterday = localDateStr(new Date(Date.now() - 86_400_000))

  const [date, setDate]                     = useState(today)
  const [sales, setSales]                   = useState<HistSale[]>([])
  const [loading, setLoading]               = useState(false)
  const [expanded, setExpanded]             = useState<Set<number>>(new Set())
  const [editingPayment, setEditingPayment] = useState<HistPayment | null>(null)

  const load = useCallback(async (d: string) => {
    setLoading(true)
    try {
      const data = await api.get<HistSale[]>(`/sales?date=${d}`)
      setSales(data)
      setExpanded(new Set())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(date) }, [date, load])

  // Group by table number, sorted
  const byTable = [...sales
    .reduce((map, sale) => {
      const t = sale.tableNumber ?? 0
      if (!map.has(t)) map.set(t, [])
      map.get(t)!.push(sale)
      return map
    }, new Map<number, HistSale[]>())
    .entries()
  ].sort(([a], [b]) => a - b)

  const toggleTable = (n: number) =>
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(n) ? next.delete(n) : next.add(n)
      return next
    })

  const handleSavePayment = async (paymentId: string, method: string) => {
    await api.patch(`/payments/${paymentId}`, { method })
    setSales(prev => prev.map(sale => ({
      ...sale,
      payments: sale.payments.map(p => p.id === paymentId ? { ...p, method } : p),
    })))
    setEditingPayment(null)
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200 touch-btn">
          <ArrowLeft size={22} />
        </button>
        <History size={18} className="text-slate-400" />
        <span className="text-slate-200 font-medium flex-1">Histórico de Mesas</span>
        {loading && <span className="text-xs text-slate-500 animate-pulse">Carregando...</span>}
      </div>

      {/* Date selector */}
      <div className="bg-slate-800 border-b border-slate-700 px-3 py-2 shrink-0 flex items-center gap-2">
        {[{ label: 'Hoje', val: today }, { label: 'Ontem', val: yesterday }].map(({ label, val }) => (
          <button key={val} onClick={() => setDate(val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium touch-btn transition-colors
              ${date === val ? 'bg-emerald-700 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-slate-200 text-xs focus:outline-none" />
        <span className="text-slate-600 text-xs ml-auto">
          {byTable.length} mesa{byTable.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {!loading && byTable.length === 0 && (
          <div className="flex items-center justify-center h-32 text-slate-600 text-sm">
            Nenhuma mesa encerrada neste dia.
          </div>
        )}

        {byTable.map(([tableNumber, tableSales]) => {
          const isOpen     = expanded.has(tableNumber)
          const tableTotal = tableSales.reduce((s, sale) => s + sale.total, 0)
          const names      = [...new Set(tableSales.map(s => s.customerName).filter(Boolean))]

          return (
            <div key={tableNumber} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              {/* Table header */}
              <button onClick={() => toggleTable(tableNumber)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left touch-btn hover:bg-slate-700/50">
                <span className="bg-emerald-700 text-white px-2.5 py-1 rounded-full text-sm font-bold shrink-0">
                  Mesa {tableNumber}
                </span>
                <div className="flex-1 min-w-0">
                  {names.length > 0 && (
                    <div className="text-sm text-slate-200 font-medium truncate">{names.join(', ')}</div>
                  )}
                  <div className="text-xs text-slate-500">
                    {tableSales.length} venda{tableSales.length !== 1 ? 's' : ''} · {fmtBRL(tableTotal)}
                  </div>
                </div>
                {isOpen
                  ? <ChevronDown size={16} className="text-slate-500 shrink-0" />
                  : <ChevronRight size={16} className="text-slate-500 shrink-0" />}
              </button>

              {/* Expanded: sale details */}
              {isOpen && tableSales.map((sale, si) => {
                const activeItems = sale.items.filter(i => !i.cancelled)
                return (
                  <div key={sale.id}
                    className={`px-4 py-3 ${si === 0 ? 'border-t border-slate-700' : 'border-t-2 border-slate-600'}`}>
                    {/* Sale header */}
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-xs text-slate-500">
                        {fmtTime(sale.openedAt)}
                        {sale.closedAt ? ` → ${fmtTime(sale.closedAt)}` : ''}
                        {' · '}{sale.operatorName}
                      </span>
                      <span className="text-sm font-semibold text-slate-200">{fmtBRL(sale.total)}</span>
                    </div>

                    {/* Items */}
                    <div className="space-y-0.5 mb-3">
                      {activeItems.map(item => (
                        <div key={item.id} className="flex justify-between text-xs text-slate-400">
                          <span>{item.qty}× {item.productName}</span>
                          <span>{fmtBRL(item.subtotal)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Payments */}
                    <div className="border-t border-slate-700/60 pt-2 space-y-1.5">
                      {sale.payments.map(payment => (
                        <div key={payment.id} className="flex items-center justify-between">
                          <span className="text-xs text-slate-300 font-medium">
                            {METHOD_LABELS[payment.method] ?? payment.method}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400">{fmtBRL(payment.amount)}</span>
                            <button onClick={() => setEditingPayment(payment)}
                              className="w-6 h-6 flex items-center justify-center rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-slate-200 touch-btn">
                              <Pencil size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {editingPayment && (
        <EditPaymentModal
          payment={editingPayment}
          onSave={handleSavePayment}
          onClose={() => setEditingPayment(null)}
        />
      )}
    </div>
  )
}
