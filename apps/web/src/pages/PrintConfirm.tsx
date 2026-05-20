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
  const [printed, setPrinted] = useState(false)

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
        const job = await api.post<{ id: string; payload: string }>('/print/sale/' + saleId, {})
        const payload = JSON.parse(job.payload) as PrintPayload
        printReceipt(payload)
        await api.patch(`/print/${job.id}`, { action: 'printed' })
        setPrinted(true)
      } else {
        const job = await api.post<{ id: string }>('/print/sale/' + saleId, {})
        await api.patch(`/print/${job.id}`, { action: 'skipped' })
      }
    } catch {
      // print failure must not block flow
    }

    const nextPath = sale?.type === 'table' ? '/mesa' : sale?.type === 'delivery' ? '/' : '/balcao'
    clearSale()
    if (choice === 'print') {
      setTimeout(() => navigate(nextPath), 1200)
    } else {
      navigate(nextPath)
    }
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

        {printed && (
          <div className="w-full py-2 rounded-xl bg-emerald-100 text-emerald-700 text-sm font-semibold text-center">
            Imprimindo comprovante...
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
          {confirming && !printed ? 'Aguarde...' : confirming && printed ? 'Imprimindo...' : 'CONFIRMAR'}
        </button>
      </div>
    </div>
  )
}

// --- Receipt printing via a temporary window (HTML fallback) ---

interface PrintPayload {
  saleType: string
  date: string
  operatorName: string
  tableNumber: number | null
  customerName: string | null
  customerAddress: string | null
  items: { name: string; qty: number; unitPrice: number; subtotal: number }[]
  subtotal: number
  discount: number
  total: number
  payments: { method: string; amount: number }[]
  troco: number
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  debit: 'Cartão Débito',
  credit: 'Cartão Crédito',
  pix: 'Pix',
  voucher: 'Voucher',
  conta_receita: 'Conta Receita',
}

function printReceipt(p: PrintPayload) {
  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const dateStr = new Date(p.date).toLocaleString('pt-BR')

  const itemRows = p.items
    .map(
      (i) =>
        `<tr><td>${i.qty}x ${i.name}</td><td style="text-align:right">R$ ${fmt(i.subtotal)}</td></tr>`,
    )
    .join('')

  const paymentRows = p.payments
    .map(
      (pay) =>
        `<tr><td>${METHOD_LABELS[pay.method] ?? pay.method}</td><td style="text-align:right">R$ ${fmt(pay.amount)}</td></tr>`,
    )
    .join('')

  const trocoRow =
    p.troco > 0
      ? `<tr><td><strong>Troco</strong></td><td style="text-align:right"><strong>R$ ${fmt(p.troco)}</strong></td></tr>`
      : ''

  const customerInfo =
    p.saleType === 'delivery' && p.customerName
      ? `<p>${p.customerName}</p><p>${p.customerAddress ?? ''}</p>`
      : p.tableNumber
        ? `<p>Mesa ${p.tableNumber}</p>`
        : ''

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Cupom</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px; }
  h1 { font-size: 14px; text-align: center; margin-bottom: 4px; }
  .center { text-align: center; }
  .small { font-size: 10px; color: #555; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; }
  .total-row td { font-size: 14px; font-weight: bold; padding-top: 4px; }
</style>
</head>
<body>
<h1>PDV BAR &amp; RESTAURANTE</h1>
<p class="center small">${dateStr}</p>
<p class="center small">Operador: ${p.operatorName}</p>
${customerInfo ? `<hr>${customerInfo}` : ''}
<hr>
<table>${itemRows}</table>
<hr>
<table>
  <tr class="total-row">
    <td>TOTAL</td>
    <td style="text-align:right">R$ ${fmt(p.total)}</td>
  </tr>
</table>
<hr>
<table>${paymentRows}${trocoRow}</table>
<hr>
<p class="center small">Obrigado pela visita!</p>
</body>
</html>`

  const w = window.open('', '_blank', 'width=400,height=600')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  w.print()
  // Close the window after print dialog is dismissed
  w.onafterprint = () => w.close()
}
