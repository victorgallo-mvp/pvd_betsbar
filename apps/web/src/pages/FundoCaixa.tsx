import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Wallet, CheckCircle } from 'lucide-react'
import { useAuth } from '../stores/useAuth'
import { useCash } from '../stores/useCash'
import { CurrencyKeypad, formatCents } from '../components/CurrencyKeypad'

export default function FundoCaixa() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeSession, isLoading, initialized, error, fetchActiveSession, openSession, clearError } = useCash()

  const [cents, setCents] = useState(0)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchActiveSession()
  }, [fetchActiveSession])

  const handleAbrir = async () => {
    if (!user || cents < 0) return
    try {
      await openSession(user.id, cents / 100)
      setSuccess(true)
      setTimeout(() => navigate('/'), 1800)
    } catch {
      // error shown via store
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    })

  if (!initialized) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <Header onBack={() => navigate('/')} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-slate-500 animate-pulse">Carregando...</div>
        </div>
      </div>
    )
  }

  // Already has an open session
  if (activeSession) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <Header onBack={() => navigate('/')} />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-slate-800 rounded-2xl border border-emerald-700 p-8 w-96 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-emerald-400">
              <CheckCircle size={28} />
              <span className="text-lg font-bold">Caixa aberto</span>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Operador" value={activeSession.operatorName} />
              <Row label="Abertura" value={formatDate(activeSession.openedAt)} />
              <Row
                label="Fundo inicial"
                value={fmtBRL(activeSession.openingFund)}
                highlight
              />
            </div>
            <p className="text-slate-500 text-xs mt-2">
              Para encerrar o caixa, use a opção <strong>Encerrar</strong> no menu principal.
            </p>
            <button
              onClick={() => navigate('/')}
              className="mt-2 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium touch-btn"
            >
              Voltar ao Menu
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-600 flex items-center justify-center">
            <CheckCircle size={44} className="text-white" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">Caixa aberto!</div>
          <div className="text-slate-400 text-sm">Fundo: {fmtBRL(cents / 100)}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <Header onBack={() => navigate('/')} />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex flex-col gap-5 w-80">
          {/* Amount display */}
          <div className="bg-slate-800 rounded-2xl p-5 text-center border border-slate-700">
            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wide">
              Fundo de abertura
            </div>
            <div className="text-4xl font-mono font-bold text-slate-100">
              R$ {formatCents(cents)}
            </div>
          </div>

          {/* Keypad */}
          <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
            <CurrencyKeypad cents={cents} onChange={setCents} disabled={isLoading} className="h-56" />
          </div>

          {error && <p className="text-rose-400 text-sm text-center">{error}</p>}

          <button
            onClick={handleAbrir}
            disabled={isLoading}
            className="
              py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500
              text-white font-bold text-lg
              touch-btn disabled:opacity-40
              flex items-center justify-center gap-2
            "
          >
            <Wallet size={20} />
            {isLoading ? 'Abrindo...' : 'Abrir Caixa'}
          </button>
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
      <Wallet size={18} className="text-slate-400" />
      <span className="text-slate-200 font-medium">Fundo de Caixa</span>
    </div>
  )
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={highlight ? 'text-emerald-400 font-bold' : 'text-slate-300'}>{value}</span>
    </div>
  )
}

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
