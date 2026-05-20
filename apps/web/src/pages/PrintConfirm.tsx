import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { PrinterCheck, X } from 'lucide-react'
import { useSale } from '../stores/useSale'
import { api } from '../lib/api'

interface LocationState {
  trocoCents?: number
}

type Choice = 'print' | 'skip'

// Shown after payment for all sale types (table, counter, delivery).
// REGRA: ficha só imprime após recebimento — PrintService valida isso na API.
export default function PrintConfirm() {
  const { saleId } = useParams<{ saleId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { currentSale, loadSale, clearSale, saleOperator } = useSale()

  const trocoCents = (location.state as LocationState)?.trocoCents ?? 0
  const [choice, setChoice] = useState<Choice>('print')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!saleOperator) navigate('/venda')
    if (saleId) loadSale(saleId)
  }, [saleId]) // eslint-disable-line

  const sale = currentSale

  const handleConfirm = async () => {
    if (!saleId || confirming) return
    setConfirming(true)

    try {
      if (choice === 'print') {
        // Cria job pendente — agente térmico pega e imprime
        await api.post('/print/sale/' + saleId, {})
      } else {
        const job = await api.post<{ id: string }>('/print/sale/' + saleId, {})
        await api.patch(`/print/${job.id}`, { action: 'skipped' })
      }
    } catch {
      // falha no job não bloqueia o fluxo
    }

    const nextPath = sale?.type === 'table' ? '/mesa' : sale?.type === 'delivery' ? '/' : '/balcao'
    clearSale()
    navigate(nextPath)
  }

  const fmtBRL = (n: number) =>
    n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="h-full flex items-center justify-center bg-slate-900/95 backdrop-blur">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 flex flex-col items-center gap-6">
        {/* Troco */}
        <div className="text-center">
          <div className="text-slate-500 text-sm">Troco</div>
          <div className="text-3xl font-bold text-emerald-600">
            {fmtBRL(trocoCents / 100)}
          </div>
        </div>

        {/* Print choice */}
        <div className="flex gap-4 w-full">
          <button
            onClick={() => setChoice('print')}
            className={`
              flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 touch-btn
              transition-all
              ${choice === 'print'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 text-slate-400 hover:border-slate-300'
              }
            `}
          >
            <PrinterCheck size={36} />
            <span className="text-xs font-semibold">IMPRIMIR</span>
          </button>

          <button
            onClick={() => setChoice('skip')}
            className={`
              flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 touch-btn
              transition-all
              ${choice === 'skip'
                ? 'border-slate-400 bg-slate-100 text-slate-600'
                : 'border-slate-200 text-slate-400 hover:border-slate-300'
              }
            `}
          >
            <div className="relative">
              <PrinterCheck size={36} className="opacity-40" />
              <X size={18} className="absolute -top-1 -right-1 text-rose-500" strokeWidth={3} />
            </div>
            <span className="text-xs font-semibold">NÃO IMPRIMIR</span>
          </button>
        </div>

        {/* Sale summary snippet */}
        {sale && (
          <div className="w-full bg-slate-50 rounded-xl p-3 text-xs text-slate-500 space-y-0.5">
            {sale.items.filter(i => !i.cancelled).map(item => (
              <div key={item.id} className="flex justify-between">
                <span>{item.qty}× {item.productName}</span>
                <span>{fmtBRL(item.subtotal)}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-1 flex justify-between font-bold text-slate-700 text-sm">
              <span>Total</span>
              <span>{fmtBRL(sale.total)}</span>
            </div>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={confirming}
          className="
            w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white
            font-bold text-base touch-btn disabled:opacity-50
          "
        >
          {confirming ? 'Aguarde...' : 'CONFIRMAR'}
        </button>
      </div>
    </div>
  )
}
