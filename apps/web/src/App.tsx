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

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/cardapio" element={<Cardapio />} />

      <Route path="/login" element={<LoginPin />} />

      <Route path="/" element={<RequireAuth><MenuPrincipal /></RequireAuth>} />

      <Route path="/venda" element={<RequireAuth><VendaEntry /></RequireAuth>} />
      <Route path="/mesa" element={<RequireAuth><MesaSelector /></RequireAuth>} />
      <Route path="/comanda/:saleId" element={<RequireAuth><Comanda /></RequireAuth>} />
      <Route path="/balcao" element={<RequireAuth><BalcaoComanda /></RequireAuth>} />
      <Route path="/delivery" element={<RequireAuth><DeliveryEntry /></RequireAuth>} />
      <Route path="/delivery/:saleId" element={<RequireAuth><BalcaoComanda /></RequireAuth>} />
      <Route path="/pagamento/:saleId" element={<RequireAuth><Pagamento /></RequireAuth>} />
      <Route path="/print-confirm/:saleId" element={<RequireAuth><PrintConfirm /></RequireAuth>} />
      <Route path="/caixa"    element={<RequireAuth><FundoCaixa /></RequireAuth>} />
      <Route path="/sangria"  element={<RequireAuth><Sangria /></RequireAuth>} />
      <Route path="/encerrar"  element={<RequireAuth><EncerrarCaixa /></RequireAuth>} />
      <Route path="/cadastro"  element={<RequireAuth><Cadastro /></RequireAuth>} />
      <Route path="/relatorio" element={<RequireAuth><Relatorio /></RequireAuth>} />
      <Route path="/config"    element={<RequireAuth><Configurar /></RequireAuth>} />
      <Route path="/consulta"  element={<RequireAuth><Consulta /></RequireAuth>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
