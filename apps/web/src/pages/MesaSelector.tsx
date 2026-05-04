import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingBag, Bike, LogOut } from 'lucide-react'
import { useTables } from '../stores/useTables'
import { useSale } from '../stores/useSale'
import { useWebSocket } from '../hooks/useWebSocket'
import { useDevice } from '../hooks/useDevice'
import { MesaCard } from '../components/MesaCard'
import { NumericKeypad } from '../components/NumericKeypad'

export default function MesaSelector() {
  const navigate = useNavigate()
  const { tables, fetchTables, isLoading } = useTables()
  const { saleOperator, openSale, clearSaleOperator } = useSale()
  const { isPOS } = useDevice()

  const [inputNum, setInputNum] = useState('')
  const [busyMsg, setBusyMsg] = useState('')

  useEffect(() => { if (!saleOperator) navigate('/venda') }, [saleOperator, navigate])
  useEffect(() => { fetchTables() }, [fetchTables])
  useWebSocket()

  const handleSelectMesa = async (tableNumber: number) => {
    const table = tables.find((t) => t.number === tableNumber)
    if (!table) { setBusyMsg(`Mesa ${tableNumber} não existe`); setTimeout(() => setBusyMsg(''), 2000); return }

    if (table.status === 'awaiting_payment') {
      const res = await fetch(`/api/tables/${table.id}/active-sale`)
      if (res.ok) { const sale = await res.json(); navigate(`/pagamento/${sale.id}`) }
      return
    }
    if (table.status === 'open') {
      const res = await fetch(`/api/tables/${table.id}/active-sale`)
      if (res.ok) { const sale = await res.json(); navigate(`/comanda/${sale.id}`) }
      return
    }

    if (!saleOperator) return
    setBusyMsg('Abrindo mesa...')
    try {
      const sale = await openSale({ type: 'table', tableId: table.id, operatorId: saleOperator.id })
      navigate(`/comanda/${sale.id}`)
    } catch {
      setBusyMsg('Erro ao abrir mesa')
      setTimeout(() => setBusyMsg(''), 2000)
    }
  }

  const handleOk = () => {
    const num = Number(inputNum)
    if (!num) return
    setInputNum('')
    handleSelectMesa(num)
  }

  const topBar = (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
      <button onClick={() => navigate('/venda')} className="text-slate-400 hover:text-slate-200 touch-btn">
        <ArrowLeft size={22} />
      </button>
      <span className="text-emerald-400 font-bold flex-1">Mesa</span>
      <span className="text-slate-400 text-sm">{saleOperator?.name}</span>
    </div>
  )

  const bottomBar = (
    <div className="flex items-center gap-1 px-3 py-2 bg-slate-800 border-t border-slate-700 shrink-0">
      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-700 text-white">
        Mesas
      </button>
      <button onClick={() => navigate('/balcao')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 touch-btn">
        <ShoppingBag size={16} /><span>Balcão</span>
      </button>
      <button onClick={() => navigate('/delivery')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-slate-200 touch-btn">
        <Bike size={16} /><span>Delivery</span>
      </button>
      <div className="flex-1" />
      <button onClick={() => { clearSaleOperator(); navigate('/') }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-400 hover:text-rose-400 touch-btn">
        <LogOut size={16} /><span>Sair</span>
      </button>
    </div>
  )

  const activeTables = tables.filter((t) => t.status !== 'free')

  const mesaGrid = (cols: string, source: typeof tables) => (
    <>
      {isLoading ? (
        <div className="text-slate-500 text-sm animate-pulse">Carregando mesas...</div>
      ) : source.length === 0 ? (
        <div className="text-slate-600 text-sm text-center py-4">Nenhuma mesa</div>
      ) : (
        <div className={`grid ${cols} gap-2`}>
          {source.map((t) => (
            <MesaCard key={t.id} table={t} onClick={() => handleSelectMesa(t.number)} />
          ))}
        </div>
      )}
      {busyMsg && <div className="text-amber-400 text-sm font-medium mt-2">{busyMsg}</div>}
    </>
  )

  // ── POS portrait layout ───────────────────────────────────
  if (isPOS) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        {topBar}

        {/* Compact number input row */}
        <div className="px-3 pt-2 pb-1 shrink-0 flex items-center gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={2}
            value={inputNum}
            onChange={(e) => setInputNum(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onKeyDown={(e) => e.key === 'Enter' && handleOk()}
            placeholder="Nº mesa"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 text-lg font-mono font-bold placeholder-slate-600 outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleOk}
            disabled={!inputNum}
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm touch-btn disabled:opacity-40 shrink-0"
          >
            Ir
          </button>
        </div>

        {/* All tables — scrollable grid */}
        <div className="flex-1 overflow-y-auto px-3 pb-2 pt-1">
          {isLoading ? (
            <div className="text-slate-500 text-sm animate-pulse py-4 text-center">Carregando mesas...</div>
          ) : tables.length === 0 ? (
            <div className="text-slate-600 text-sm text-center py-4">Nenhuma mesa</div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {tables.map((t) => (
                <MesaCard key={t.id} table={t} onClick={() => handleSelectMesa(t.number)} compact />
              ))}
            </div>
          )}
          {busyMsg && <div className="text-amber-400 text-sm font-medium mt-2 text-center">{busyMsg}</div>}
        </div>

        {bottomBar}
      </div>
    )
  }

  // ── Tablet landscape layout ───────────────────────────────
  return (
    <div className="h-full flex flex-col bg-slate-900">
      {topBar}

      <div className="flex-1 flex min-h-0">
        {/* Left — all mesas */}
        <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">
          {mesaGrid('grid-cols-5', tables)}
        </div>

        {/* Right — keypad */}
        <div className="w-64 flex flex-col p-3 border-l border-slate-700 shrink-0 gap-3">
          <div className="bg-slate-800 rounded-xl px-4 py-3 text-right">
            <div className="text-xs text-slate-500 mb-1">Informe mesa</div>
            <div className="text-4xl font-mono font-bold text-slate-100 min-h-[2.5rem]">
              {inputNum || <span className="text-slate-700">_</span>}
            </div>
          </div>
          <NumericKeypad value={inputNum} onChange={setInputNum} maxLength={2} onConfirm={handleOk} />
        </div>
      </div>

      {bottomBar}
    </div>
  )
}
