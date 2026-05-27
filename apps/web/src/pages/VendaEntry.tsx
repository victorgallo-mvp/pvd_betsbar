import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed, ShoppingBag, Bike, ArrowLeft } from 'lucide-react'
import { useAuth } from '../stores/useAuth'
import { useSale } from '../stores/useSale'

export default function VendaEntry() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { setSaleOperator } = useSale()

  useEffect(() => {
    if (user) setSaleOperator(user)
  }, [user, setSaleOperator])

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
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200 touch-btn">
          <ArrowLeft size={22} />
        </button>
        <span className="text-slate-300 font-medium">
          Operador: <span className="text-emerald-400 font-bold">{user?.name}</span>
        </span>
      </div>

      <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-4 p-8">
        {modes.map((mode) => {
          const Icon = mode.icon
          return (
            <button
              key={mode.id}
              onClick={() => navigate(mode.path)}
              className={`
                ${mode.color}
                flex flex-col items-center justify-center gap-3
                w-full sm:w-52 h-36 sm:h-44 rounded-2xl
                touch-btn text-white transition-colors duration-100
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
