import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart,
  Wallet,
  PowerOff,
  ArrowDownLeft,
  ClipboardList,
  BarChart3,
  Settings,
  Search,
  LogOut,
  Circle,
} from 'lucide-react'
import { useAuth } from '../stores/useAuth'
import { useCash } from '../stores/useCash'

const menuItems = [
  { id: 'venda',      label: 'Venda',          sub: 'Faz venda de produtos',       icon: ShoppingCart,  path: '/venda',    color: 'bg-slate-700 hover:bg-slate-600' },
  { id: 'fundo',      label: 'Fundo de Caixa', sub: 'Insere fundo de caixa',       icon: Wallet,        path: '/caixa',    color: 'bg-emerald-700 hover:bg-emerald-600' },
  { id: 'encerrar',   label: 'Encerrar',       sub: 'Totaliza movimento caixa',    icon: PowerOff,      path: '/encerrar', color: 'bg-slate-700 hover:bg-slate-600' },
  { id: 'sangria',    label: 'Sangria',        sub: 'Realiza retirada do caixa',   icon: ArrowDownLeft, path: '/sangria',  color: 'bg-emerald-700 hover:bg-emerald-600' },
  { id: 'cadastro',   label: 'Cadastro',       sub: 'Manutenção de cadastros',     icon: ClipboardList, path: '/cadastro', color: 'bg-emerald-700 hover:bg-emerald-600' },
  { id: 'relatorio',  label: 'Relatório',      sub: 'Analisa sua movimentação',    icon: BarChart3,     path: '/relatorio',color: 'bg-slate-700 hover:bg-slate-600' },
  { id: 'configurar', label: 'Configurar',     sub: 'Parâmetros, impressoras...',  icon: Settings,      path: '/config',   color: 'bg-emerald-700 hover:bg-emerald-600' },
  { id: 'consulta',   label: 'Consulta',       sub: 'Consulta os produtos',        icon: Search,        path: '/consulta', color: 'bg-emerald-700 hover:bg-emerald-600' },
  { id: 'sair',       label: 'Sair',           sub: 'Finaliza sistema',            icon: LogOut,        path: null,        color: 'bg-slate-700 hover:bg-slate-600' },
]

export default function MenuPrincipal() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { activeSession, fetchActiveSession } = useCash()

  useEffect(() => {
    fetchActiveSession()
  }, [fetchActiveSession])

  const handleItem = (item: typeof menuItems[0]) => {
    if (item.id === 'sair') { logout(); navigate('/login'); return }
    if (item.path) navigate(item.path)
  }

  const sessionOpen = !!activeSession

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-slate-400 text-sm">
          Operador: <span className="text-slate-100 font-semibold">{user?.name}</span>
        </span>

        {/* Cash session indicator */}
        <div className="flex items-center gap-1.5">
          <Circle
            size={8}
            className={sessionOpen ? 'fill-emerald-400 text-emerald-400' : 'fill-slate-600 text-slate-600'}
          />
          <span className={`text-xs font-medium ${sessionOpen ? 'text-emerald-400' : 'text-slate-500'}`}>
            {sessionOpen ? `Caixa aberto — ${activeSession.operatorName}` : 'Caixa fechado'}
          </span>
        </div>

        <span className="text-slate-600 text-xs">PDV v0.1</span>
      </div>

      {/* Grid: 2 cols on mobile, 3 cols on tablet */}
      <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-2 p-3">
        {menuItems.map((item) => {
          const Icon = item.icon

          // Highlight cash-related items based on session state
          const needsAttention =
            (item.id === 'fundo' && !sessionOpen) ||
            (item.id === 'encerrar' && sessionOpen)

          return (
            <button
              key={item.id}
              onClick={() => handleItem(item)}
              className={`
                ${needsAttention
                  ? item.id === 'fundo'
                    ? 'bg-amber-700 hover:bg-amber-600 ring-2 ring-amber-500'
                    : item.color
                  : item.color
                }
                flex flex-col items-start justify-center
                rounded-xl px-4 py-3 gap-1
                touch-btn text-left transition-colors duration-100
                relative
              `}
            >
              <Icon size={28} className="text-white mb-1" />
              <span className="text-white font-semibold text-base leading-tight">{item.label}</span>
              <span className="text-slate-300 text-xs leading-tight">{item.sub}</span>

              {/* Dot for "needs attention" items */}
              {needsAttention && item.id === 'fundo' && (
                <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
