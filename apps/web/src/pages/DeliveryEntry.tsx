import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bike } from 'lucide-react'
import { useSale } from '../stores/useSale'

export default function DeliveryEntry() {
  const navigate = useNavigate()
  const { saleOperator, openSale, isLoading } = useSale()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')

  useEffect(() => {
    if (!saleOperator) navigate('/venda')
  }, [saleOperator, navigate])

  const handleNext = async () => {
    if (!name.trim() || !address.trim() || !saleOperator) return
    const sale = await openSale({
      type: 'delivery',
      operatorId: saleOperator.id,
      customerName: name.trim(),
      customerAddress: address.trim(),
    })
    navigate(`/delivery/${sale.id}`)
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
        <button onClick={() => navigate('/venda')} className="text-slate-400 hover:text-slate-200 touch-btn">
          <ArrowLeft size={22} />
        </button>
        <Bike size={20} className="text-slate-400" />
        <span className="text-slate-200 font-medium">Novo Delivery</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md flex flex-col gap-5 bg-slate-800 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-slate-100 font-bold text-lg">Dados do cliente</h2>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium">Nome *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do cliente"
              className="
                bg-slate-700 border border-slate-600 rounded-xl px-4 py-3
                text-slate-100 placeholder-slate-500 text-sm
                focus:outline-none focus:border-emerald-500
                user-select-text
              "
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium">Endereço *</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, bairro..."
              rows={3}
              className="
                bg-slate-700 border border-slate-600 rounded-xl px-4 py-3
                text-slate-100 placeholder-slate-500 text-sm resize-none
                focus:outline-none focus:border-emerald-500
                user-select-text
              "
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-medium">Telefone (opcional)</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              type="tel"
              className="
                bg-slate-700 border border-slate-600 rounded-xl px-4 py-3
                text-slate-100 placeholder-slate-500 text-sm
                focus:outline-none focus:border-emerald-500
                user-select-text
              "
            />
          </div>

          <button
            onClick={handleNext}
            disabled={!name.trim() || !address.trim() || isLoading}
            className="
              py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500
              text-white font-bold text-base
              touch-btn disabled:opacity-40 disabled:cursor-not-allowed
              flex items-center justify-center gap-2
            "
          >
            {isLoading ? 'Abrindo...' : 'Próximo — Selecionar Produtos'}
          </button>
        </div>
      </div>
    </div>
  )
}
