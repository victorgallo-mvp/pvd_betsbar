import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Users, DoorOpen } from 'lucide-react'
import { useSale } from '../stores/useSale'
import { useDevice } from '../hooks/useDevice'
import { CurrencyKeypad, formatCents } from '../components/CurrencyKeypad'

type Method = 'cash' | 'debit' | 'credit' | 'pix' | 'voucher' | 'conta_receita'

const METHODS: { id: Method; label: string; color: string }[] = [
  { id: 'cash',   label: 'Dinheiro',      color: 'border-emerald-500 bg-emerald-900/40 text-emerald-300' },
  { id: 'debit',  label: 'Cartão Débito', color: 'border-blue-500 bg-blue-900/40 text-blue-300' },
  { id: 'credit', label: 'Cartão Crédito',color: 'border-rose-500 bg-rose-900/40 text-rose-300' },
  { id: 'pix',    label: 'Pix',           color: 'border-emerald-400 bg-emerald-900/30 text-emerald-400' },
]

const BILLS = [50_00, 20_00, 10_00, 5_00]

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Pagamento() {
  const { saleId } = useParams<{ saleId: string }>()
  const navigate = useNavigate()
  const { saleOperator, currentSale, loadSale, registerPayment, cancelSale, isLoading } = useSale()
  const { isPOS } = useDevice()

  const [cents, setCents] = useState(0)
  const [method, setMethod] = useState<Method>('cash')
  const [done, setDone] = useState(false)
  const [splitPeople, setSplitPeople] = useState(1)
  const [darTroco, setDarTroco] = useState(true)
  const [confirmClose, setConfirmClose] = useState(false)

  useEffect(() => { if (!saleOperator) navigate('/venda') }, [saleOperator, navigate])
  useEffect(() => { if (saleId) loadSale(saleId) }, [saleId, loadSale])
  useEffect(() => {
    if (currentSale) {
      const paid = currentSale.payments?.reduce((s, p) => s + p.amount, 0) ?? 0
      const residual = Math.max(0, currentSale.total - paid)
      setCents(Math.round((residual / splitPeople) * 100))
    }
  }, [currentSale?.id])

  const sale = currentSale
  const totalCents = Math.round((sale?.total ?? 0) * 100)
  const paidCents = Math.round((sale?.payments?.reduce((s, p) => s + p.amount, 0) ?? 0) * 100)
  const residualCents = Math.max(0, totalCents - paidCents)
  const splitPartCents = Math.round(residualCents / splitPeople)
  const referenceCents = splitPeople > 1 ? splitPartCents : residualCents
  const trocoCents = method === 'cash' ? Math.max(0, cents - referenceCents) : 0
  // amount actually applied to the sale: if giving change back, net = cents - troco; else full cents
  const amountToApply = trocoCents > 0 && !darTroco ? cents : cents - trocoCents

  const handleSplitChange = (n: number) => {
    const people = Math.max(1, n)
    setSplitPeople(people)
    const curResidual = Math.max(0, totalCents - paidCents)
    setCents(Math.round(curResidual / people))
  }

  const handleEncerrarMesa = async () => {
    if (!saleId) return
    await cancelSale(saleId)
    navigate('/mesa')
  }

  const handleOk = async () => {
    if (!saleId || cents <= 0) return
    const result = await registerPayment(saleId, method, amountToApply / 100)
    if (result.status === 'paid') {
      setDone(true)
      const trocoVal = darTroco ? trocoCents : 0
      setTimeout(() => navigate(`/print-confirm/${saleId}`, { state: { trocoCents: trocoVal } }), 1500)
    } else {
      // partial — reload, decrement split, recalc
      await loadSale(saleId)
      const newPeople = Math.max(1, splitPeople - 1)
      setSplitPeople(newPeople)
      const newResidual = Math.max(0, totalCents - paidCents - amountToApply)
      setCents(Math.round(newResidual / newPeople))
      setDarTroco(true)
    }
  }

  if (done) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center">
            <Check size={44} className="text-white" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">Pagamento confirmado!</div>
          <div className="text-slate-400 text-sm">Gerando comprovante...</div>
        </div>
      </div>
    )
  }

  // ── Encerrar Mesa ─────────────────────────────────────────

  const encerrarModal = confirmClose && (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 flex flex-col gap-4 max-w-sm w-full border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-3">
          <DoorOpen size={22} className="text-rose-400 shrink-0" />
          <span className="text-slate-100 font-semibold">Encerrar mesa sem pagamento?</span>
        </div>
        <p className="text-slate-400 text-sm">A venda será cancelada e a mesa ficará livre.</p>
        <div className="flex gap-3">
          <button
            onClick={() => setConfirmClose(false)}
            className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-medium touch-btn"
          >
            Voltar
          </button>
          <button
            onClick={handleEncerrarMesa}
            disabled={isLoading}
            className="flex-1 py-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold touch-btn disabled:opacity-40"
          >
            Encerrar
          </button>
        </div>
      </div>
    </div>
  )

  // ── Shared atoms ──────────────────────────────────────────

  const topBar = (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
      <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-200 touch-btn">
        <ArrowLeft size={22} />
      </button>
      <span className="bg-emerald-700 text-white px-3 py-1 rounded-full text-sm font-bold">
        {sale?.tableNumber ? `Mesa ${sale.tableNumber}` : sale?.type === 'delivery' ? 'Delivery' : 'Balcão'}
      </span>
      <span className="text-slate-400 text-sm flex-1">Pagamento</span>
      <span className="text-slate-500 text-xs">{saleOperator?.name}</span>
      {sale?.type === 'table' && (
        <button
          onClick={() => setConfirmClose(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/50 hover:bg-rose-900 text-rose-400 text-xs font-medium touch-btn border border-rose-800"
        >
          <DoorOpen size={14} />
          Encerrar Mesa
        </button>
      )}
    </div>
  )

  const valorTroco = (
    <div className="flex flex-col gap-2 shrink-0">
      {/* paid so far — only show when there are partial payments */}
      {paidCents > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-800 rounded-xl px-3 py-2 border border-slate-600">
            <div className="text-xs text-slate-500">Já pago</div>
            <div className="text-lg font-mono font-bold text-emerald-400">R$ {formatCents(paidCents)}</div>
          </div>
          <div className="bg-slate-800 rounded-xl px-3 py-2 border border-amber-700">
            <div className="text-xs text-slate-500">Falta pagar</div>
            <div className="text-lg font-mono font-bold text-amber-400">R$ {formatCents(residualCents)}</div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-800 rounded-xl px-3 py-2">
          <div className="text-xs text-slate-500">Valor recebido</div>
          <div className="text-2xl font-mono font-bold text-slate-100">R$ {formatCents(cents)}</div>
        </div>
        <div className="bg-slate-800 rounded-xl px-3 py-2">
          <div className="text-xs text-slate-500">Troco</div>
          <div className={`text-2xl font-mono font-bold ${trocoCents > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
            R$ {formatCents(trocoCents)}
          </div>
        </div>
      </div>
      {trocoCents > 0 && (
        <button
          onClick={() => setDarTroco((v) => !v)}
          className={`w-full py-2 rounded-xl text-sm font-semibold border-2 touch-btn transition-colors ${
            darTroco
              ? 'border-amber-500 bg-amber-900/30 text-amber-300'
              : 'border-slate-600 bg-slate-800 text-slate-400'
          }`}
        >
          {darTroco
            ? `Dar troco — cobra R$ ${formatCents(amountToApply)}`
            : `Sem troco — cobra R$ ${formatCents(cents)}`}
        </button>
      )}
    </div>
  )

  const splitControl = (
    <div className="flex items-center gap-2 shrink-0 bg-slate-800 rounded-xl px-3 py-2 border border-slate-700">
      <Users size={16} className="text-slate-400 shrink-0" />
      <span className="text-xs text-slate-400 flex-1">Dividir por</span>
      <button onClick={() => handleSplitChange(splitPeople - 1)}
        className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold touch-btn flex items-center justify-center">
        −
      </button>
      <span className="w-6 text-center text-slate-100 font-bold">{splitPeople}</span>
      <button onClick={() => handleSplitChange(splitPeople + 1)}
        className="w-8 h-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold touch-btn flex items-center justify-center">
        +
      </button>
      <span className="text-xs text-slate-400 ml-1">= R$ {formatCents(Math.round(residualCents / splitPeople))}</span>
    </div>
  )

  const cedulas = (
    <div className="flex gap-2 shrink-0">
      {BILLS.map(bill => (
        <button key={bill} onClick={() => setCents(bill)}
          className="flex-1 py-2.5 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-emerald-200 text-base font-bold touch-btn">
          R$ {bill / 100}
        </button>
      ))}
    </div>
  )

  const methodButtons = (cols: string) => (
    <div className={`grid ${cols} gap-2 shrink-0`}>
      {METHODS.map(m => (
        <button key={m.id} onClick={() => setMethod(m.id)}
          className={`py-3 rounded-lg border-2 text-sm font-semibold touch-btn transition-all ${
            method === m.id ? m.color : 'border-slate-700 bg-slate-800 text-slate-500 hover:border-slate-600'
          }`}>
          {m.label}
        </button>
      ))}
    </div>
  )

  const okBtn = (full?: boolean) => (
    <button onClick={handleOk} disabled={isLoading || cents <= 0}
      className={`
        ${full ? 'w-full py-5 rounded-2xl text-2xl' : 'w-24 h-24 rounded-full'}
        bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700
        text-white font-bold touch-btn
        disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center
      `}>
      {isLoading ? '...' : 'OK'}
    </button>
  )

  const emptyTableBanner = totalCents === 0 && sale?.type === 'table' && (
    <div className="mx-3 mt-3 p-3 rounded-xl bg-amber-900/40 border border-amber-700 text-amber-300 text-sm text-center">
      Mesa sem consumo — use <strong>Encerrar Mesa</strong> no topo para liberar a mesa.
    </div>
  )

  // ── POS portrait: vertical stack matching Stone POS ───────
  if (isPOS) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        {encerrarModal}
        {topBar}
        {emptyTableBanner}
        <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-3">
          {valorTroco}
          {splitControl}
          {cedulas}
          <CurrencyKeypad cents={cents} onChange={setCents} disabled={isLoading} className="h-64" />
          {methodButtons('grid-cols-2')}
          {okBtn(true)}
          {/* Compact sale summary at bottom */}
          {sale && (
            <div className="bg-slate-800 rounded-xl p-3 border border-slate-700 text-xs space-y-1">
              {sale.items.filter(i => !i.cancelled).map(item => (
                <div key={item.id} className="flex justify-between text-slate-400">
                  <span>{item.qty}× {item.productName}</span>
                  <span>{fmtBRL(item.subtotal)}</span>
                </div>
              ))}
              <div className="border-t border-slate-700 pt-1 flex justify-between font-bold text-slate-200">
                <span>Total</span>
                <span className="text-emerald-400">{fmtBRL(sale.total)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Tablet landscape: 3-column ────────────────────────────
  return (
    <div className="h-full flex flex-col bg-slate-900">
      {encerrarModal}
      {topBar}
      {emptyTableBanner}
      <div className="flex-1 flex min-h-0">
        {/* LEFT — sale summary */}
        <div className="w-[22%] flex flex-col border-r border-slate-700 p-3 gap-2 min-h-0">
          <div className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Resumo</div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {sale?.items.filter(i => !i.cancelled).map(item => (
              <div key={item.id} className="flex justify-between text-sm text-slate-300">
                <span className="truncate pr-2">{item.qty}× {item.productName}</span>
                <span className="shrink-0 text-slate-400">{fmtBRL(item.subtotal)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-700 pt-2 space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Subtotal</span><span>{fmtBRL(sale?.subtotal ?? 0)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-100">
              <span>Total</span><span className="text-emerald-400">{fmtBRL(sale?.total ?? 0)}</span>
            </div>
            {sale?.perPersonAmount != null && sale.peopleCount != null && (
              <div className="text-xs text-amber-400">
                {fmtBRL(sale.perPersonAmount)} × {sale.peopleCount} pessoas
              </div>
            )}
            {(sale?.payments?.length ?? 0) > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700 space-y-1">
                <div className="text-xs text-slate-500 uppercase tracking-wide">Pagamentos</div>
                {sale!.payments.map((p) => (
                  <div key={p.id} className="flex justify-between text-xs">
                    <span className="text-slate-400 capitalize">{p.method}</span>
                    <span className="text-emerald-400">{fmtBRL(p.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-bold text-amber-400 pt-1">
                  <span>Falta</span><span>{fmtBRL(residualCents / 100)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER — keypad + methods */}
        <div className="flex-1 flex flex-col p-3 gap-2 min-h-0">
          {valorTroco}
          {splitControl}
          {cedulas}
          <CurrencyKeypad cents={cents} onChange={setCents} disabled={isLoading} className="flex-1 min-h-0" />
          {methodButtons('grid-cols-2')}
        </div>

        {/* RIGHT — OK */}
        <div className="w-28 flex flex-col items-center justify-center border-l border-slate-700 p-3 shrink-0">
          {okBtn()}
        </div>
      </div>
    </div>
  )
}
