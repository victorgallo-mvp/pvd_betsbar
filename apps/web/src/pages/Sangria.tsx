import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowDownLeft, CheckCircle, AlertCircle } from 'lucide-react'
import { useCash } from '../stores/useCash'
import { CurrencyKeypad, formatCents } from '../components/CurrencyKeypad'

export default function Sangria() {
  const navigate = useNavigate()
  const { activeSession, isLoading, error, fetchActiveSession, withdraw } = useCash()

  const [cents, setCents] = useState(0)
  const [reason, setReason] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchActiveSession()
  }, [fetchActiveSession])

  const handleConfirm = async () => {
    if (cents <= 0 || !reason.trim()) return
    try {
      await withdraw(cents / 100, reason.trim())
      setSuccess(true)
      setTimeout(() => navigate('/'), 2000)
    } catch {
      // error shown via store
    }
  }

  if (success) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-600 flex items-center justify-center">
            <CheckCircle size={44} className="text-white" />
          </div>
          <div className="text-2xl font-bold text-amber-400">Sangria registrada</div>
          <div className="text-slate-400">{fmtBRL(cents / 100)}</div>
        </div>
      </div>
    )
  }

  // No active session
  if (!isLoading && !activeSession) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <Header onBack={() => navigate('/')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center p-6">
            <AlertCircle size={48} className="text-amber-500" />
            <div className="text-slate-300 font-semibold">Nenhum caixa aberto</div>
            <p className="text-slate-500 text-sm">
              Abra o caixa primeiro em <strong>Fundo de Caixa</strong>.
            </p>
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

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <Header onBack={() => navigate('/')} />

      <div className="flex-1 flex min-h-0">
        {/* Left — info + reason */}
        <div className="w-[40%] flex flex-col p-5 gap-4 border-r border-slate-700">
          {activeSession && (
            <div className="bg-slate-800 rounded-xl p-4 text-sm space-y-2 border border-slate-700">
              <div className="text-xs text-slate-500 uppercase tracking-wide">Caixa ativo</div>
              <div className="flex justify-between">
                <span className="text-slate-500">Operador</span>
                <span className="text-slate-300">{activeSession.operatorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fundo</span>
                <span className="text-slate-300">{fmtBRL(activeSession.openingFund)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sangrias</span>
                <span className="text-amber-400 font-semibold">
                  {activeSession.withdrawals.length}×
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-xs text-slate-400 font-semibold uppercase tracking-wide">
              Motivo *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Troco para funcionário, pagamento fornecedor..."
              rows={4}
              className="
                bg-slate-800 border border-slate-700 rounded-xl px-4 py-3
                text-slate-100 placeholder-slate-600 text-sm resize-none
                focus:outline-none focus:border-amber-500
                user-select-text
              "
            />
          </div>

          {error && <p className="text-rose-400 text-sm">{error}</p>}

          <button
            onClick={handleConfirm}
            disabled={isLoading || cents <= 0 || !reason.trim()}
            className="
              mt-auto py-4 rounded-xl
              bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white
              font-bold text-base touch-btn
              disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2
            "
          >
            <ArrowDownLeft size={20} />
            {isLoading ? 'Registrando...' : `Confirmar Sangria`}
          </button>
        </div>

        {/* Right — keypad */}
        <div className="flex-1 flex flex-col p-5 gap-4">
          <div className="bg-slate-800 rounded-xl p-4 text-center border border-slate-700">
            <div className="text-xs text-slate-500 mb-1">Valor da sangria</div>
            <div className="text-4xl font-mono font-bold text-amber-400">
              R$ {formatCents(cents)}
            </div>
          </div>

          <CurrencyKeypad
            cents={cents}
            onChange={setCents}
            disabled={isLoading}
            className="flex-1"
          />
        </div>
      </div>
    </div>
  )
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
      <button onClick={onBack} className="text-slate-400 hover:text-slate-200 touch-btn">
        <ArrowLeft size={22} />
      </button>
      <ArrowDownLeft size={18} className="text-amber-400" />
      <span className="text-slate-200 font-medium">Sangria</span>
    </div>
  )
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
