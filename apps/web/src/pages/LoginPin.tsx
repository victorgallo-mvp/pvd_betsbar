import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Delete } from 'lucide-react'
import { useAuth } from '../stores/useAuth'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

export default function LoginPin() {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const { login, isLoading, error, clearError } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (error) {
      setShake(true)
      setPin('')
      const t = setTimeout(() => { setShake(false); clearError() }, 600)
      return () => clearTimeout(t)
    }
  }, [error, clearError])

  const handleKey = async (key: string) => {
    if (isLoading) return

    if (key === '⌫') {
      setPin((p) => p.slice(0, -1))
      return
    }

    const next = pin + key
    setPin(next)

    if (next.length === 4) {
      const ok = await login(next)
      if (ok) navigate('/')
      // error triggers shake via useEffect above
    }
  }

  return (
    <div className="h-full flex items-center justify-center bg-slate-900">
      <div className="flex flex-col items-center gap-8 p-8 bg-slate-800 rounded-2xl shadow-2xl w-72">
        {/* App name */}
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-100 tracking-tight">PDV</div>
          <div className="text-sm text-slate-400 mt-1">Informe seu PIN</div>
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

        {/* Error message */}
        {error && (
          <div className="text-rose-400 text-sm font-medium -mt-4">{error}</div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {KEYS.map((key, idx) => {
            if (key === '') return <div key={idx} />

            return (
              <button
                key={idx}
                onClick={() => handleKey(key)}
                disabled={isLoading || (pin.length >= 4 && key !== '⌫')}
                className="
                  aspect-square rounded-xl text-xl font-semibold
                  bg-slate-700 hover:bg-slate-600 active:bg-slate-500
                  text-slate-100 touch-btn
                  flex items-center justify-center
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors duration-100
                "
              >
                {key === '⌫' ? <Delete size={20} /> : key}
              </button>
            )
          })}
        </div>

        {isLoading && (
          <div className="text-emerald-400 text-sm animate-pulse">Verificando...</div>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  )
}
