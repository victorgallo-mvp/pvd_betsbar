import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Check, Receipt, CreditCard,
  Plus, Minus, ArrowRightLeft, CheckCheck, ShoppingCart, List, DoorOpen,
} from 'lucide-react'
import { useSale } from '../stores/useSale'
import { useDevice } from '../hooks/useDevice'
import type { CategoryDTO, ProductDTO } from '@pdv/shared'
import { api } from '../lib/api'


function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function FecharMesaDialog({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-72 shadow-2xl border border-slate-700">
        <h2 className="text-lg font-bold text-slate-100 mb-2">Fechar Mesa</h2>
        <p className="text-slate-400 text-sm mb-5">Cancelar venda e liberar a mesa?</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-slate-700 text-slate-300 touch-btn">
            Voltar
          </button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-rose-700 text-white font-bold touch-btn">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// Category color mapping (matches seed)
const CATEGORY_COLORS: Record<string, string> = {
  cat_favoritos: 'bg-amber-600 hover:bg-amber-500',
  cat_fichas: 'bg-blue-700 hover:bg-blue-600',
  cat_espetos: 'bg-emerald-700 hover:bg-emerald-600',
  cat_porcoes: 'bg-emerald-700 hover:bg-emerald-600',
  cat_bebidas: 'bg-emerald-700 hover:bg-emerald-600',
  cat_pastelaria: 'bg-slate-600 hover:bg-slate-500',
  cat_cervejas: 'bg-slate-600 hover:bg-slate-500',
  cat_burguer: 'bg-rose-700 hover:bg-rose-600',
}

export default function Comanda() {
  const { saleId } = useParams<{ saleId: string }>()
  const navigate = useNavigate()
  const { saleOperator, currentSale, loadSale, addItem, removeItem, concludeItems, requestBill, cancelSale } =
    useSale()
  const { isPOS } = useDevice()

  const [categories, setCategories] = useState<CategoryDTO[]>([])
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [showFecharConfirm, setShowFecharConfirm] = useState(false)
  const [addingItem, setAddingItem] = useState<string | null>(null)
  const [posTab, setPosTab] = useState<'products' | 'pedido'>('products')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warning' } | null>(null)

  // Require sale operator
  useEffect(() => {
    if (!saleOperator) navigate('/venda')
  }, [saleOperator, navigate])

  // Load sale and categories
  useEffect(() => {
    if (!saleId) return
    loadSale(saleId)
    api.get<CategoryDTO[]>('/products/categories').then(setCategories)
  }, [saleId, loadSale])

  // Load products when category changes
  useEffect(() => {
    const query = selectedCat ? `?categoryId=${selectedCat}` : '?categoryId=cat_favoritos'
    api.get<ProductDTO[]>(`/products${query}`).then(setProducts)
  }, [selectedCat])

  const handleAddProduct = async (productId: string) => {
    if (!saleId || addingItem) return
    setAddingItem(productId)
    await addItem(saleId, productId)
    setAddingItem(null)
  }

  const showToast = (msg: string, type: 'success' | 'warning') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleConcluir = async () => {
    if (!saleId) return
    const { printed, queued } = await concludeItems(saleId)
    if (queued > 0) {
      showToast('Impressora offline — pedido na fila, será impresso quando voltar', 'warning')
    } else if (printed > 0) {
      showToast('Pedido enviado pra cozinha ✓', 'success')
    } else {
      showToast('Nenhum item novo para enviar', 'warning')
    }
  }

  const handleConta = async () => {
    if (!saleId) return
    await requestBill(saleId, 1)
    navigate('/mesa')
  }

  const handleFecharMesa = async () => {
    if (!saleId) return
    await cancelSale(saleId)
    navigate('/mesa')
  }

  const handlePagar = () => {
    if (!saleId) return
    navigate(`/pagamento/${saleId}`)
  }

  const sale = currentSale
  const activeItems = sale?.items.filter((i) => !i.cancelled) ?? []
  const pendingCount = activeItems.filter((i) => !i.sentToProduction).length

  // ── Shared sub-panels ──────────────────────────────────────

  const TopBar = () => (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
      <button onClick={() => navigate('/mesa')} className="text-slate-400 hover:text-slate-200 touch-btn">
        <ArrowLeft size={22} />
      </button>
      <div className="flex items-center gap-2 flex-1">
        <span className="bg-emerald-700 text-white px-3 py-1 rounded-full text-sm font-bold">
          Mesa {sale?.tableNumber ?? '—'}
        </span>
        {sale?.status === 'awaiting_payment' && (
          <span className="bg-amber-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
            aguardando pagamento
          </span>
        )}
      </div>
      <span className="text-slate-500 text-xs">{saleOperator?.name}</span>
    </div>
  )

  const ItemList = () => (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {activeItems.length === 0 ? (
        <div className="text-slate-600 text-sm p-4 text-center">
          {isPOS ? 'Vá para "Produtos" para adicionar itens.' : 'Nenhum item ainda. Toque nos produtos ao lado.'}
        </div>
      ) : (
        activeItems.map((item, idx) => (
          <div key={item.id} className={`flex items-center gap-2 px-2 py-2 rounded-lg ${item.sentToProduction ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
            <span className="text-slate-600 text-xs w-5 shrink-0">{idx + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-200 truncate font-medium">{item.productName}</div>
              <div className="text-xs text-slate-500">{item.qty} × {fmtBRL(item.unitPrice)}</div>
            </div>
            {item.sentToProduction
              ? <Check size={14} className="text-emerald-400 shrink-0" />
              : <button onClick={() => removeItem(saleId!, item.id)} className="text-slate-600 hover:text-rose-400 touch-btn shrink-0"><Minus size={14} /></button>
            }
            <span className="text-sm font-semibold text-slate-300 shrink-0 w-16 text-right">{fmtBRL(item.subtotal)}</span>
          </div>
        ))
      )}
    </div>
  )

  const Totals = () => (
    <div className="border-t border-slate-700 px-3 py-2 bg-slate-800/60 shrink-0">
      <div className="flex text-xs text-slate-500 gap-3 mb-1">
        <span>SUBTOTAL <span className="text-slate-400">{fmtBRL(sale?.subtotal ?? 0)}</span></span>
        <span>DESC. <span className="text-slate-400">{fmtBRL(sale?.discount ?? 0)}</span></span>
      </div>
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-bold text-slate-100">Total</span>
          <span className="text-xs text-slate-500">{activeItems.length} iten{activeItems.length !== 1 ? 's' : ''}</span>
        </div>
        <span className="text-2xl font-bold text-emerald-400">{fmtBRL(sale?.total ?? 0)}</span>
      </div>
      {sale?.perPersonAmount != null && sale.peopleCount != null && (
        <div className="text-xs text-amber-400 mt-1">{fmtBRL(sale.perPersonAmount)} / pessoa ({sale.peopleCount} pessoas)</div>
      )}
    </div>
  )

  const ActionBar = ({ tablet }: { tablet?: boolean }) => (
    <div className={`${tablet ? 'grid grid-cols-6' : 'grid grid-cols-3'} gap-1 p-2 bg-slate-800 border-t border-slate-700 shrink-0`}>
      {[
        { icon: Receipt,        label: 'Conta',    action: handleConta,                    active: sale?.status !== 'awaiting_payment' },
        { icon: DoorOpen,       label: 'Fechar',   action: () => setShowFecharConfirm(true), active: true },
        { icon: CreditCard,     label: 'Pagar',    action: handlePagar,                    active: true },
        { icon: Plus,           label: 'Qtde',     action: () => {},                       active: false },
        { icon: ArrowRightLeft, label: 'Transf.',  action: () => {},                       active: false },
        { icon: CheckCheck,     label: 'Concluir', action: handleConcluir,                 active: pendingCount > 0 },
      ].map(({ icon: Icon, label, action, active }) => (
        <button key={label} onClick={action} disabled={!active}
          className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg text-[10px] touch-btn
            ${active
              ? label === 'Concluir' ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
              : label === 'Pagar' ? 'bg-blue-700 hover:bg-blue-600 text-white'
              : label === 'Fechar' ? 'bg-rose-800 hover:bg-rose-700 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}>
          <Icon size={18} />
          <span className="leading-tight text-center">{label}</span>
          {label === 'Concluir' && pendingCount > 0 && (
            <span className="bg-amber-500 text-black text-[9px] font-bold px-1 rounded-full">{pendingCount}</span>
          )}
        </button>
      ))}
    </div>
  )

  const ProductPanel = () => (
    <div className="flex-1 flex flex-col min-h-0">
      <div className={`grid ${isPOS ? 'grid-cols-4' : 'grid-cols-4'} gap-1 p-2 shrink-0`}>
        {categories.map((cat) => (
          <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
            className={`py-3 px-1 rounded-lg text-xs font-semibold text-white text-center leading-tight touch-btn
              ${selectedCat === cat.id ? (CATEGORY_COLORS[cat.id] ?? 'bg-emerald-600') : 'bg-slate-700 hover:bg-slate-600'}`}>
            {cat.name}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-1 p-2 content-start">
        {products.map((prod) => (
          <button key={prod.id} onClick={() => handleAddProduct(prod.id)} disabled={addingItem === prod.id}
            className={`flex flex-col items-start p-3 rounded-lg border text-left touch-btn
              ${addingItem === prod.id ? 'bg-emerald-900 border-emerald-600 opacity-70' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>
            <span className="text-sm font-medium text-slate-200 leading-tight">{prod.name}</span>
            <span className="text-emerald-400 font-bold text-sm mt-1">{fmtBRL(prod.price)}</span>
          </button>
        ))}
      </div>
    </div>
  )

  const Toast = () =>
    toast ? (
      <div
        className={`fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl text-sm font-semibold text-white max-w-xs text-center pointer-events-none transition-all
          ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-amber-600'}`}
      >
        {toast.msg}
      </div>
    ) : null

  // ── POS portrait layout: tab-based ────────────────────────
  if (isPOS) {
    return (
      <div className="h-full flex flex-col bg-slate-900">
        <Toast />
        <TopBar />
        <div className="flex-1 min-h-0 flex flex-col">
          {posTab === 'products' ? (
            <ProductPanel />
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <ItemList />
              <Totals />
            </div>
          )}
        </div>

        {/* Action bar — always visible on both tabs */}
        <ActionBar />

        {/* Bottom tab switcher */}
        <div className="grid grid-cols-2 border-t border-slate-700 shrink-0">
          <button onClick={() => setPosTab('products')}
            className={`flex items-center justify-center gap-2 py-3 text-sm font-medium touch-btn border-r border-slate-700 ${posTab === 'products' ? 'text-emerald-400 bg-slate-800' : 'text-slate-500'}`}>
            <ShoppingCart size={18} /> Produtos
          </button>
          <button onClick={() => setPosTab('pedido')}
            className={`flex items-center justify-center gap-2 py-3 text-sm font-medium touch-btn ${posTab === 'pedido' ? 'text-emerald-400 bg-slate-800' : 'text-slate-500'}`}>
            <List size={18} />
            Pedido
            {activeItems.length > 0 && (
              <span className="bg-emerald-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {activeItems.length}
              </span>
            )}
          </button>
        </div>
        {showFecharConfirm && <FecharMesaDialog onConfirm={handleFecharMesa} onClose={() => setShowFecharConfirm(false)} />}
      </div>
    )
  }

  // ── Tablet landscape layout ───────────────────────────────
  return (
    <div className="h-full flex flex-col bg-slate-900">
      <Toast />
      <TopBar />
      <div className="flex-1 flex min-h-0">
        <div className="w-[45%] flex flex-col border-r border-slate-700 min-h-0">
          <ItemList />
          <Totals />
          <ActionBar tablet />
        </div>
        <ProductPanel />
      </div>
      {showFecharConfirm && <FecharMesaDialog onConfirm={handleFecharMesa} onClose={() => setShowFecharConfirm(false)} />}
    </div>
  )
}
