import { Routes, Route, Navigate } from 'react-router-dom'
import LoginPin from './pages/LoginPin'
import MenuPrincipal from './pages/MenuPrincipal'
import VendaEntry from './pages/VendaEntry'
import MesaSelector from './pages/MesaSelector'
import Comanda from './pages/Comanda'
import BalcaoComanda from './pages/BalcaoComanda'
import DeliveryEntry from './pages/DeliveryEntry'
import Pagamento from './pages/Pagamento'
import PrintConfirm from './pages/PrintConfirm'
import FundoCaixa from './pages/FundoCaixa'
import Sangria from './pages/Sangria'
import EncerrarCaixa from './pages/EncerrarCaixa'
import Cadastro from './pages/Cadastro'
import Relatorio from './pages/Relatorio'
import Configurar from './pages/Configurar'
import Consulta from './pages/Consulta'
import Cardapio from './pages/Cardapio'
import { useAuth } from './stores/useAuth'
import type { UserRole } from '@pdv/shared'

const ROLE_LEVEL: Record<UserRole, number> = { admin: 3, operator: 2, waiter: 1 }

function hasMinRole(userRole: UserRole, min: UserRole) {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[min]
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireRole({ min, children }: { min: UserRole; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!hasMinRole(user.role, min)) return <Navigate to="/" replace />
  return <>{children}</>
}

export { hasMinRole }

export default function App() {
  return (
    <Routes>
      <Route path="/cardapio" element={<Cardapio />} />

      <Route path="/login" element={<LoginPin />} />

      <Route path="/" element={<RequireAuth><MenuPrincipal /></RequireAuth>} />

      {/* waiter+ */}
      <Route path="/venda"              element={<RequireRole min="waiter"><VendaEntry /></RequireRole>} />
      <Route path="/mesa"               element={<RequireRole min="waiter"><MesaSelector /></RequireRole>} />
      <Route path="/comanda/:saleId"    element={<RequireRole min="waiter"><Comanda /></RequireRole>} />
      <Route path="/balcao"             element={<RequireRole min="waiter"><BalcaoComanda /></RequireRole>} />
      <Route path="/delivery"           element={<RequireRole min="waiter"><DeliveryEntry /></RequireRole>} />
      <Route path="/delivery/:saleId"   element={<RequireRole min="waiter"><BalcaoComanda /></RequireRole>} />
      <Route path="/consulta"           element={<RequireRole min="waiter"><Consulta /></RequireRole>} />

      {/* operator+ */}
      <Route path="/pagamento/:saleId"  element={<RequireRole min="waiter"><Pagamento /></RequireRole>} />
      <Route path="/print-confirm/:saleId" element={<RequireRole min="operator"><PrintConfirm /></RequireRole>} />
      <Route path="/caixa"              element={<RequireRole min="operator"><FundoCaixa /></RequireRole>} />
      <Route path="/sangria"            element={<RequireRole min="operator"><Sangria /></RequireRole>} />
      <Route path="/encerrar"           element={<RequireRole min="operator"><EncerrarCaixa /></RequireRole>} />
      <Route path="/relatorio"          element={<RequireRole min="operator"><Relatorio /></RequireRole>} />

      {/* admin only */}
      <Route path="/cadastro"           element={<RequireRole min="admin"><Cadastro /></RequireRole>} />
      <Route path="/config"             element={<RequireRole min="admin"><Configurar /></RequireRole>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
