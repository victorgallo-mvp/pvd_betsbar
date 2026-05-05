import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed, ShoppingBag, Bike, Delete, ArrowLeft } from 'lucide-react'
import { useAuth } from '../stores/useAuth'
import { useSale } from '../stores/useSale'
import { api } from '../lib/api'
import type { UserDTO } from '@pdv/shared'

// Two-phase page: PIN entry → mode selection
// The per-sale PIN identifies which operator is making this sale,
// allowing multiple waiters to share the same tablet.

type Phase = 'pin' | 'mode'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export default function VendaEntry() {
  const [phase, setPhase] = useState<Phase>('pin')
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [pinError, setPinError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const { user } = useAuth()
  const { saleOperator, setSaleOperator } = useSale()

  // If already have a sale operator from a previous action, skip PIN phase
  useEffect(() => {
    if (saleOperator) setPhase('mode')
  }, [saleOperator])

  const handleKey = async (key: string) => {
    if (loading) return
    if (key === '⌫') { setPin((p) => p.slice(0, -1)); return }

    const next = pin + key
    setPin(next)

    if (next.length === 4) {
      setLoading(true)
      try {
        const operator = await api.post<UserDTO>('/auth/login', { pin: next })
        setSaleOperator(operator)
        setPhase('mode')
      } catch {
        setPinError('PIN incorreto')
        setShake(true)
        setPin('')
        setTimeout(() => { setShake(false); setPinError('') }, 600)
      } finally {
        setLoading(false)
      }
    }
  }

  if (phase === 'pin') {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200 touch-btn">
            <ArrowLeft size={22} />
          </button>
          <span className="text-slate-300 font-medium">Identificação do operador</span>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-6 p-8 bg-slate-800 rounded-2xl shadow-2xl w-72">
            <div className="text-center">
              <div className="text-lg font-semibold text-slate-100">Informe seu PIN</div>
              {user && (
                <div className="text-xs text-slate-400 mt-1">
                  Logado como {user.name} — ou entre com outro PIN
                </div>
              )}
            </div>

            {/* PIN dots */}
            <div className={`flex gap-4 ${shake ? 'animate-shake' : ''}`}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                    i < pin.length
                      ? 'bg-emerald-400 border-emerald-400 scale-110'
                      : 'bg-transparent border-slate-500'
                  }`}
                />
              ))}
            </div>

            {pinError && <div className="text-rose-400 text-sm -mt-3">{pinError}</div>}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-3 w-full">
              {KEYS.map((key, idx) => {
                if (key === '') return <div key={idx} />
                return (
                  <button
                    key={idx}
                    onClick={() => handleKey(key)}
                    disabled={loading || (pin.length >= 4 && key !== '⌫')}
                    className="
                      aspect-square rounded-xl text-xl font-semibold
                      bg-slate-700 hover:bg-slate-600 active:bg-slate-500
                      text-slate-100 touch-btn flex items-center justify-center
                      disabled:opacity-40
                    "
                  >
                    {key === '⌫' ? <Delete size={20} /> : key}
                  </button>
                )
              })}
            </div>

            {loading && <div className="text-emerald-400 text-sm animate-pulse">Verificando...</div>}
          </div>
        </div>

        <style>{`
          @keyframes shake {
            0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)}
            40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)}
          }
          .animate-shake{animation:shake 0.5s ease-in-out}
        `}</style>
      </div>
    )
  }

  // Mode selection
  const modes = [
    {
      id: 'mesa',
      label: 'Mesa',
      sub: 'Atendimento com comanda',
      icon: UtensilsCrossed,
      color: 'bg-emerald-700 hover:bg-emerald-600',
      path: '/mesa',
    },
    {
      id: 'balcao',
      label: 'Balcão / Ficha',
      sub: 'Venda direta com impressão',
      icon: ShoppingBag,
      color: 'bg-slate-700 hover:bg-slate-600',
      path: '/balcao',
    },
    {
      id: 'delivery',
      label: 'Delivery',
      sub: 'Pedido para entrega',
      icon: Bike,
      color: 'bg-slate-700 hover:bg-slate-600',
      path: '/delivery',
    },
  ]

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700">
        <button
          onClick={() => { setPhase('pin'); setPin('') }}
          className="text-slate-400 hover:text-slate-200 touch-btn"
        >
          <ArrowLeft size={22} />
        </button>
        <span className="text-slate-300 font-medium">
          Operador:{' '}
          <span className="text-emerald-400 font-bold">{saleOperator?.name}</span>
        </span>
      </div>

      <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-4 p-8">
        {modes.map((mode) => {
          const Icon = mode.icon
          return (
            <button
              key={mode.id}
              onClick={() => mode.path && navigate(mode.path)}
              disabled={!mode.path}
              className={`
                ${mode.color}
                flex flex-col items-center justify-center gap-3
                w-full sm:w-52 h-36 sm:h-44 rounded-2xl
                touch-btn text-white
                disabled:cursor-not-allowed
                transition-colors duration-100
              `}
            >
              <Icon size={48} />
              <div>
                <div className="font-bold text-lg">{mode.label}</div>
                <div className="text-xs text-slate-300">{mode.sub}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
