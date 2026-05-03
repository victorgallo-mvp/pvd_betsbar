import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Trash2, CreditCard, Minus } from 'lucide-react'
import { useSale } from '../stores/useSale'
import type { CategoryDTO, ProductDTO } from '@pdv/shared'
import { api } from '../lib/api'

// Shared between Balcão (/balcao) and Delivery (/delivery/:saleId).
// When saleId is present in params, loads that sale (delivery mode).
// When absent, creates the sale lazily on first product added (counter mode).

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

function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function BalcaoComanda() {
  const { saleId: paramSaleId } = useParams<{ saleId?: string }>()
  const navigate = useNavigate()
  const { saleOperator, currentSale, loadSale, openSale, addItem, removeItem, clearSale } =
    useSale()

  const [categories, setCategories] = useState<CategoryDTO[]>([])
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [addingItem, setAddingItem] = useState<string | null>(null)
  const creatingRef = useRef(false) // prevent double sale creation on fast taps

  const isDelivery = !!paramSaleId
  const saleType = isDelivery ? 'delivery' : 'counter'

  // Require sale operator
  useEffect(() => {
    if (!saleOperator) navigate('/venda')
  }, [saleOperator, navigate])

  // Load categories + initial products
  useEffect(() => {
    api.get<CategoryDTO[]>('/products/categories').then(setCategories)
    api.get<ProductDTO[]>('/products?categoryId=cat_favoritos').then(setProducts)
  }, [])

  // For delivery mode: load the existing sale
  useEffect(() => {
    if (paramSaleId) {
      loadSale(paramSaleId)
    } else {
      // Counter mode: start fresh (clear any previous paid/abandoned sale)
      if (!currentSale || currentSale.status === 'paid' || currentSale.type !== 'counter') {
        clearSale()
      }
    }
  }, [paramSaleId]) // eslint-disable-line

  // Load products when category changes
  useEffect(() => {
    const query = selectedCat ? `?categoryId=${selectedCat}` : '?categoryId=cat_favoritos'
    api.get<ProductDTO[]>(`/products${query}`).then(setProducts)
  }, [selectedCat])

  const getOrCreateSale = async (): Promise<string | null> => {
    if (currentSale?.id && currentSale.type === saleType) return currentSale.id
    if (creatingRef.current) return null
    if (!saleOperator) return null

    creatingRef.current = true
    try {
      const sale = await openSale({ type: saleType, operatorId: saleOperator.id })
      return sale.id
    } finally {
      creatingRef.current = false
    }
  }

  const handleAddProduct = async (productId: string) => {
    if (addingItem) return
    setAddingItem(productId)
    try {
      const saleId = await getOrCreateSale()
      if (!saleId) return
      await addItem(saleId, productId)
    } finally {
      setAddingItem(null)
    }
  }

  const handlePagar = () => {
    if (!currentSale?.id) return
    navigate(`/pagamento/${currentSale.id}`)
  }

  const handleLimpar = () => {
    clearSale()
  }

  const activeItems = currentSale?.items.filter((i) => !i.cancelled) ?? []
  const saleId = currentSale?.id ?? paramSaleId

  const headerLabel = isDelivery
    ? `Delivery — ${currentSale?.customerName ?? '...'}`
    : 'Balcão'

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <button onClick={() => navigate('/venda')} className="text-slate-400 hover:text-slate-200 touch-btn">
          <ArrowLeft size={22} />
        </button>
        <span className="bg-slate-600 text-white px-3 py-1 rounded-full text-sm font-bold">
          {headerLabel}
        </span>
        <div className="flex-1" />
        <span className="text-slate-500 text-xs">{saleOperator?.name}</span>
      </div>

      {/* Body: split layout */}
      <div className="flex-1 flex min-h-0">
        {/* LEFT — item list */}
        <div className="w-[42%] flex flex-col border-r border-slate-700 min-h-0">
          {/* Items */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {activeItems.length === 0 ? (
              <div className="text-slate-600 text-sm p-4 text-center">
                Toque nos produtos para adicionar.
              </div>
            ) : (
              activeItems.map((item, idx) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 px-2 py-2 rounded-lg bg-slate-800"
                >
                  <span className="text-slate-600 text-xs w-4 shrink-0">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 font-medium truncate">{item.productName}</div>
                    <div className="text-xs text-slate-500">
                      {item.qty} × {fmtBRL(item.unitPrice)}
                    </div>
                  </div>
                  <button
                    onClick={() => saleId && removeItem(saleId, item.id)}
                    className="text-slate-600 hover:text-rose-400 touch-btn shrink-0"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-semibold text-slate-300 shrink-0 w-16 text-right">
                    {fmtBRL(item.subtotal)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Total */}
          <div className="border-t border-slate-700 px-3 py-2 bg-slate-800/60 shrink-0">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-slate-100">Total</span>
                <span className="text-xs text-slate-500">
                  {activeItems.length} iten{activeItems.length !== 1 ? 's' : ''}
                </span>
              </div>
              <span className="text-2xl font-bold text-emerald-400">
                {fmtBRL(currentSale?.total ?? 0)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-2 p-2 bg-slate-800 border-t border-slate-700 shrink-0">
            <button
              onClick={handleLimpar}
              disabled={activeItems.length === 0}
              className="
                flex items-center justify-center gap-2 py-3 rounded-xl
                bg-slate-700 hover:bg-slate-600 text-slate-300
                touch-btn disabled:opacity-40 disabled:cursor-not-allowed
                font-medium text-sm
              "
            >
              <Trash2 size={16} />
              Limpar
            </button>
            <button
              onClick={handlePagar}
              disabled={activeItems.length === 0}
              className="
                flex items-center justify-center gap-2 py-3 rounded-xl
                bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white
                touch-btn disabled:opacity-40 disabled:cursor-not-allowed
                font-bold text-base
              "
            >
              <CreditCard size={18} />
              Pagar
            </button>
          </div>
        </div>

        {/* RIGHT — categories + products */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Category grid */}
          <div className="grid grid-cols-4 gap-1 p-2 shrink-0">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`
                  py-3 px-1 rounded-lg text-xs font-semibold text-white text-center leading-tight
                  touch-btn transition-colors
                  ${selectedCat === cat.id
                    ? (CATEGORY_COLORS[cat.id] ?? 'bg-emerald-600')
                    : 'bg-slate-700 hover:bg-slate-600'
                  }
                `}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-1 p-2 content-start">
            {products.map((prod) => (
              <button
                key={prod.id}
                onClick={() => handleAddProduct(prod.id)}
                disabled={addingItem === prod.id}
                className={`
                  flex flex-col items-start p-2.5 rounded-lg border text-left
                  touch-btn transition-colors
                  ${addingItem === prod.id
                    ? 'bg-emerald-900 border-emerald-600 opacity-70'
                    : 'bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-slate-500'
                  }
                `}
              >
                <span className="text-sm font-medium text-slate-200 leading-tight">{prod.name}</span>
                <span className="text-emerald-400 font-bold text-sm mt-1">{fmtBRL(prod.price)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
