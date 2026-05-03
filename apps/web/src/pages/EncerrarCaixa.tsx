import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, PowerOff, AlertCircle, TrendingUp } from 'lucide-react'
import { useCash, type CashReport } from '../stores/useCash'

const METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  debit: 'Cartão Débito',
  credit: 'Cartão Crédito',
  pix: 'Pix',
  voucher: 'Voucher',
  conta_receita: 'Conta Receita',
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export default function EncerrarCaixa() {
  const navigate = useNavigate()
  const { activeSession, isLoading, fetchActiveSession, getReport, closeSession } = useCash()

  const [report, setReport] = useState<CashReport | null>(null)
  const [finalReport, setFinalReport] = useState<CashReport | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    const init = async () => {
      await fetchActiveSession()
    }
    init()
  }, [fetchActiveSession])

  // Load preview report once we know the active session
  useEffect(() => {
    if (activeSession?.id) {
      getReport(activeSession.id).then(setReport)
    }
  }, [activeSession?.id, getReport])

  const handleEncerrar = async () => {
    if (!activeSession) return
    setConfirming(true)
    try {
      const r = await closeSession(activeSession.id)
      setFinalReport(r)
      setShowConfirmDialog(false)
    } finally {
      setConfirming(false)
    }
  }

  // No active session
  if (!isLoading && !activeSession && !finalReport) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <Header onBack={() => navigate('/')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center p-6">
            <AlertCircle size={48} className="text-slate-500" />
            <div className="text-slate-300 font-semibold">Nenhum caixa aberto</div>
            <button
              onClick={() => navigate('/caixa')}
              className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-medium touch-btn"
            >
              Ir para Fundo de Caixa
            </button>
          </div>
        </div>
      </div>
    )
  }

  const displayed = finalReport ?? report
  const isClosed = !!finalReport

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <Header onBack={() => navigate('/')} />

      {/* Report */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading || !displayed ? (
          <div className="text-slate-500 text-sm animate-pulse p-4">Carregando relatório...</div>
        ) : (
          <>
            {/* Session info */}
            <Card title="Sessão">
              <Row label="Operador" value={displayed.session.operatorName} />
              <Row label="Abertura" value={formatDate(displayed.session.openedAt)} />
              {isClosed && displayed.session.closedAt && (
                <Row label="Encerramento" value={formatDate(displayed.session.closedAt)} />
              )}
              <Row label="Fundo inicial" value={fmtBRL(displayed.session.openingFund)} />
              <Row label="Vendas realizadas" value={`${displayed.paidSalesCount} venda${displayed.paidSalesCount !== 1 ? 's' : ''}`} />
            </Card>

            {/* Sales by method */}
            <Card title="Vendas por forma de pagamento">
              {displayed.salesByMethod.length === 0 ? (
                <p className="text-slate-600 text-sm">Nenhuma venda nesta sessão.</p>
              ) : (
                displayed.salesByMethod.map((m) => (
                  <div key={m.method} className="flex items-center justify-between">
                    <div>
                      <span className="text-slate-300 text-sm">
                        {METHOD_LABELS[m.method] ?? m.method}
                      </span>
                      <span className="text-slate-600 text-xs ml-2">({m.count}×)</span>
                    </div>
                    <span className="text-slate-200 font-semibold text-sm">{fmtBRL(m.total)}</span>
                  </div>
                ))
              )}
              <div className="border-t border-slate-700 pt-2 mt-1">
                <Row label="Total geral" value={fmtBRL(displayed.totalSales)} highlight />
              </div>
            </Card>

            {/* Withdrawals */}
            {displayed.withdrawals.length > 0 && (
              <Card title="Sangrias">
                {displayed.withdrawals.map((w) => (
                  <div key={w.id} className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-300 truncate">{w.reason}</div>
                      <div className="text-xs text-slate-600">{formatDate(w.createdAt)}</div>
                    </div>
                    <span className="text-amber-400 font-semibold text-sm shrink-0">
                      − {fmtBRL(w.amount)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-slate-700 pt-2 mt-1">
                  <Row label="Total sangrias" value={`− ${fmtBRL(displayed.totalWithdrawals)}`} warn />
                </div>
              </Card>
            )}

            {/* Cash balance */}
            <Card title="Resumo do caixa">
              <Row label="Fundo de abertura" value={fmtBRL(displayed.session.openingFund)} />
              <Row label="Vendas em dinheiro" value={fmtBRL(displayed.cashSales)} />
              <Row
                label="Sangrias"
                value={displayed.totalWithdrawals > 0 ? `− ${fmtBRL(displayed.totalWithdrawals)}` : fmtBRL(0)}
                warn={displayed.totalWithdrawals > 0}
              />
              <div className="border-t border-slate-700 pt-2 mt-1">
                <Row
                  label="Dinheiro esperado no caixa"
                  value={fmtBRL(displayed.expectedCash)}
                  highlight
                />
              </div>
            </Card>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div className="shrink-0 p-4 bg-slate-800 border-t border-slate-700">
        {isClosed ? (
          <button
            onClick={() => navigate('/')}
            className="w-full py-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-base touch-btn"
          >
            Voltar ao Menu Principal
          </button>
        ) : (
          <button
            onClick={() => setShowConfirmDialog(true)}
            disabled={isLoading || !displayed}
            className="
              w-full py-4 rounded-xl
              bg-rose-700 hover:bg-rose-600 active:bg-rose-800 text-white
              font-bold text-base touch-btn
              disabled:opacity-40
              flex items-center justify-center gap-2
            "
          >
            <PowerOff size={20} />
            Encerrar Caixa
          </button>
        )}
      </div>

      {/* Confirm dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-80 border border-slate-700 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-rose-400">
              <PowerOff size={24} />
              <span className="font-bold text-lg">Encerrar Caixa?</span>
            </div>
            <p className="text-slate-400 text-sm">
              Esta ação fechará a sessão atual. Certifique-se de que todas as vendas foram finalizadas.
            </p>
            {report && (
              <div className="bg-slate-900 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Total vendas</span>
                  <span>{fmtBRL(report.totalSales)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-200">
                  <span>Caixa esperado</span>
                  <span className="text-emerald-400">{fmtBRL(report.expectedCash)}</span>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 touch-btn"
              >
                Cancelar
              </button>
              <button
                onClick={handleEncerrar}
                disabled={confirming}
                className="flex-1 py-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold touch-btn disabled:opacity-50"
              >
                {confirming ? 'Encerrando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
      <button onClick={onBack} className="text-slate-400 hover:text-slate-200 touch-btn">
        <ArrowLeft size={22} />
      </button>
      <TrendingUp size={18} className="text-slate-400" />
      <span className="text-slate-200 font-medium">Encerrar Caixa</span>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <div className="px-4 py-2 bg-slate-700/50 text-xs font-semibold text-slate-400 uppercase tracking-wide">
        {title}
      </div>
      <div className="p-4 space-y-2">{children}</div>
    </div>
  )
}

function Row({
  label,
  value,
  highlight,
  warn,
}: {
  label: string
  value: string
  highlight?: boolean
  warn?: boolean
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-500 text-sm">{label}</span>
      <span
        className={`text-sm font-semibold ${
          highlight ? 'text-emerald-400 text-base' : warn ? 'text-amber-400' : 'text-slate-300'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
