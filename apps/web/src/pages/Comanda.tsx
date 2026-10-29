import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Check, Receipt, X, Pencil,
  Plus, Minus, ArrowRightLeft, CheckCheck, ShoppingCart, List, DoorOpen, Loader, Users, UserPlus, Trash2,
} from 'lucide-react'
import { useSale } from '../stores/useSale'
import { useDevice } from '../hooks/useDevice'
import type { CategoryDTO, ProductDTO, SaleItemDTO, SaleGuestDTO } from '@pdv/shared'
import { computeShares } from '@pdv/shared'
import { api } from '../lib/api'
import { track } from '../lib/diag'
import { useFeatures } from '../lib/features'


function fmtBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function AddQtyDialog({ product, guestName, onConfirm, onClose }: {
  product: ProductDTO
  guestName?: string | null
  onConfirm: (qty: number) => void
  onClose: () => void
}) {
  const [qty, setQty] = useState(1)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRepeat = (fn: () => void) => {
    fn()
    intervalRef.current = setInterval(fn, 150)
  }
  const stopRepeat = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-80 shadow-2xl border border-slate-700">
        <h2 className="text-lg font-bold text-slate-100 leading-tight">{product.name}</h2>
        <p className="text-emerald-400 font-semibold text-sm mb-1">{fmtBRL(product.price)} / un.</p>
        {guestName !== undefined && (
          <p className="text-xs text-slate-400 mb-5">para <span className="text-sky-300 font-semibold">{guestName ?? 'a mesa'}</span></p>
        )}
        {guestName === undefined && <div className="mb-5" />}
        <div className="flex items-center justify-between mb-6">
          <button
            onPointerDown={() => startRepeat(() => setQty(q => Math.max(1, q - 1)))}
            onPointerUp={stopRepeat} onPointerLeave={stopRepeat}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-rose-700 active:bg-rose-600 text-slate-200 text-3xl font-bold touch-btn select-none"
          >−</button>
          <span className="text-5xl font-bold text-slate-100 w-20 text-center tabular-nums">{qty}</span>
          <button
            onPointerDown={() => startRepeat(() => setQty(q => q + 1))}
            onPointerUp={stopRepeat} onPointerLeave={stopRepeat}
            className="w-14 h-14 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-emerald-700 active:bg-emerald-600 text-slate-200 text-3xl font-bold touch-btn select-none"
          >+</button>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 font-medium touch-btn">Voltar</button>
          <button onClick={() => onConfirm(qty)} className="flex-1 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold touch-btn">
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}

function CancelItemDialog({ item, onConfirm, onClose }: { item: SaleItemDTO; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-80 shadow-2xl border border-slate-700">
        <h2 className="text-lg font-bold text-slate-100 mb-1">Cancelar item?</h2>
        <p className="text-slate-400 text-sm mb-5">{item.qty}× <span className="text-slate-200 font-medium">{item.productName}</span></p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-slate-700 text-slate-300 touch-btn">Voltar</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl bg-rose-700 text-white font-bold touch-btn">Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function EditNomeDialog({ current, onSave, onClose }: {
  current: string
  onSave: (name: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState(current)
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-80 shadow-2xl border border-slate-700">
        <h2 className="text-lg font-bold text-slate-100 mb-4">Nome da mesa</h2>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSave(value.trim()) }}
          placeholder="Ex: João, Família Silva..."
          autoFocus
          className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-slate-700 text-slate-300 touch-btn">Voltar</button>
          <button onClick={() => onSave(value.trim())} className="flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold touch-btn">Salvar</button>
        </div>
      </div>
    </div>
  )
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

// ── Divisão por pessoa ────────────────────────────────────────

function GuestNameDialog({ title, current, onSave, onRemove, onClose }: {
  title: string
  current?: string
  onSave: (name: string) => Promise<void>
  onRemove?: () => Promise<void>
  onClose: () => void
}) {
  const [value, setValue] = useState(current ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const name = value.trim()
    if (!name) { setErr('Digite um nome'); return }
    setBusy(true)
    try { await onSave(name) } catch (e) { setErr((e as Error).message); setBusy(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-80 shadow-2xl border border-slate-700">
        <h2 className="text-lg font-bold text-slate-100 mb-4">{title}</h2>
        <input
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setErr('') }}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder="Ex: Victor"
          autoFocus
          maxLength={40}
          className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm mb-2"
        />
        {err && <p className="text-rose-400 text-xs mb-2">{err}</p>}
        <div className="flex gap-3 mt-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl bg-slate-700 text-slate-300 touch-btn">Voltar</button>
          <button onClick={submit} disabled={busy} className="flex-1 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-bold touch-btn disabled:opacity-50">Salvar</button>
        </div>
        {onRemove && (
          <button
            onClick={async () => { setBusy(true); try { await onRemove() } catch (e) { setErr((e as Error).message); setBusy(false) } }}
            disabled={busy}
            className="w-full mt-3 py-2 rounded-xl bg-rose-900/40 hover:bg-rose-800 text-rose-300 text-sm font-medium touch-btn flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Trash2 size={14} /> Remover pessoa (itens voltam para a mesa)
          </button>
        )}
      </div>
    </div>
  )
}

function MoveItemDialog({ item, guests, onMove, onClose }: {
  item: SaleItemDTO
  guests: SaleGuestDTO[]
  onMove: (guestId: string | null) => void
  onClose: () => void
}) {
  const targets: { id: string | null; name: string }[] = [{ id: null, name: 'Mesa (compartilhado)' }, ...guests.map(g => ({ id: g.id, name: g.name }))]
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-80 shadow-2xl border border-slate-700">
        <h2 className="text-lg font-bold text-slate-100 mb-1">Mover item</h2>
        <p className="text-slate-400 text-sm mb-4">{item.qty}× <span className="text-slate-200 font-medium">{item.productName}</span></p>
        <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
          {targets.map(t => {
            const current = (item.guestId ?? null) === t.id
            return (
              <button key={t.id ?? 'mesa'} onClick={() => !current && onMove(t.id)} disabled={current}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium touch-btn flex items-center gap-2
                  ${current ? 'bg-sky-900/40 text-sky-300 border border-sky-700' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}>
                {t.id === null ? <Users size={14} /> : <span className="w-3.5" />}
                <span className="flex-1 truncate">{t.name}</span>
                {current && <span className="text-[10px] uppercase">atual</span>}
              </button>
            )
          })}
        </div>
        <button onClick={onClose} className="w-full py-2 rounded-xl bg-slate-700 text-slate-300 touch-btn">Voltar</button>
      </div>
    </div>
  )
}

function ContaDialog({ guests, shares, onPick, onClose }: {
  guests: SaleGuestDTO[]
  shares: ReturnType<typeof computeShares>
  onPick: (guestId: string | null) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl p-6 w-80 shadow-2xl border border-slate-700">
        <h2 className="text-lg font-bold text-slate-100 mb-1">Conta de quem?</h2>
        <p className="text-slate-500 text-xs mb-4">Cada pessoa paga só os itens dela. Itens lançados na mesa ficam para dividir manualmente.</p>
        <div className="space-y-2 mb-4 max-h-72 overflow-y-auto">
          <button onClick={() => onPick(null)}
            className="w-full text-left px-4 py-3 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white touch-btn flex items-center gap-2">
            <Users size={16} />
            <span className="flex-1 font-semibold">Mesa toda</span>
            <span className="font-bold">{fmtBRL(shares.dueCents / 100)}</span>
          </button>
          {shares.sharedCents > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/40 border border-dashed border-slate-600 text-slate-400 text-xs">
              <Users size={12} />
              <span className="flex-1">Itens da mesa (sem pessoa)</span>
              <span className="font-semibold text-slate-300">{fmtBRL(shares.sharedCents / 100)}</span>
            </div>
          )}
          {shares.guests.map(g => (
            <button key={g.guestId} onClick={() => onPick(g.guestId)}
              className="w-full text-left px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 touch-btn flex items-center gap-2">
              <span className="flex-1 truncate">
                <span className="font-medium">{g.name}</span>
                {g.paidCents > 0 && <span className="text-xs text-emerald-400 ml-2">pago {fmtBRL(g.paidCents / 100)}</span>}
              </span>
              <span className="text-right">
                <span className="block font-semibold text-sm">{fmtBRL(g.totalCents / 100)}</span>
                {g.dueCents !== g.totalCents && <span className="block text-[10px] text-amber-400">falta {fmtBRL(g.dueCents / 100)}</span>}
              </span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-2 rounded-xl bg-slate-700 text-slate-300 touch-btn">Voltar</button>
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
  const { saleOperator, currentSale, loadSale, addItem, removeItem, cancelItem, moveItem, addGuest, renameGuest, removeGuest, updateSale, concludeItems, requestBill, cancelSale } =
    useSale()
  const { isPOS } = useDevice()
  const features = useFeatures()

  const [categories, setCategories] = useState<CategoryDTO[]>([])
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [showFecharConfirm, setShowFecharConfirm] = useState(false)
  const [addingItem, setAddingItem] = useState<string | null>(null)
  const [cancelingItem, setCancelingItem] = useState<SaleItemDTO | null>(null)
  const [pendingProduct, setPendingProduct] = useState<ProductDTO | null>(null)
  const [editingNome, setEditingNome] = useState(false)
  const [posTab, setPosTab] = useState<'products' | 'pedido'>('products')
  const [concluding, setConcluding] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warning' } | null>(null)

  // Divisão por pessoa: destino dos próximos itens (null = mesa) e diálogos
  const [targetGuest, setTargetGuest] = useState<string | null>(null)
  const [addingGuest, setAddingGuest] = useState(false)
  const [editingGuest, setEditingGuest] = useState<SaleGuestDTO | null>(null)
  const [movingItem, setMovingItem] = useState<SaleItemDTO | null>(null)
  const [showConta, setShowConta] = useState(false)

  // Require sale operator
  useEffect(() => {
    if (!saleOperator) navigate('/venda')
  }, [saleOperator, navigate])

  // Load sale and categories
  const mountedAt = useRef(0)
  useEffect(() => {
    if (!saleId) return
    // Diagnóstico: o que a tela mostra ao montar versus a venda da URL
    const shown = useSale.getState().currentSale
    mountedAt.current = performance.now()
    track('comanda_mount', {
      saleId,
      shownSaleId: shown?.id ?? null, shownTable: shown?.tableNumber ?? null, shownName: shown?.customerName ?? null,
      mismatch: !!shown && shown.id !== saleId,
    })
    loadSale(saleId)
    api.get<CategoryDTO[]>('/products/categories').then(setCategories)
  }, [saleId, loadSale])

  // Diagnóstico: quando a venda da URL de fato apareceu na tela
  useEffect(() => {
    if (!saleId || currentSale?.id !== saleId) return
    track('comanda_loaded', {
      saleId, tableNumber: currentSale.tableNumber, customerName: currentSale.customerName,
      items: currentSale.items.length, ms: Math.round(performance.now() - mountedAt.current),
    })
  }, [saleId, currentSale?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load products when category changes
  useEffect(() => {
    const query = selectedCat ? `?categoryId=${selectedCat}` : '?categoryId=cat_favoritos'
    api.get<ProductDTO[]>(`/products${query}`).then(setProducts)
  }, [selectedCat])

  const handleAddProduct = async (productId: string, qty = 1, guestId: string | null = targetGuest) => {
    if (!saleId || addingItem) return
    setAddingItem(productId)
    const shown = useSale.getState().currentSale
    track('add_item', {
      saleId, productId, qty, guestId,
      shownSaleId: shown?.id ?? null, shownTable: shown?.tableNumber ?? null, mismatch: !!shown && shown.id !== saleId,
    })
    const errBefore = useSale.getState().error
    await addItem(saleId, productId, qty, guestId)
    const errAfter = useSale.getState().error
    if (errAfter && errAfter !== errBefore) track('add_item_failed', { saleId, productId, error: errAfter })
    setAddingItem(null)
  }

  const showToast = (msg: string, type: 'success' | 'warning') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSaveNome = async (name: string) => {
    if (!saleId) return
    setEditingNome(false)
    await updateSale(saleId, { customerName: name })
    showToast('Nome atualizado ✓', 'success')
  }

  const handleConcluir = async () => {
    if (!saleId || concluding) return
    setConcluding(true)
    const shown = useSale.getState().currentSale
    track('launch', {
      saleId, pendingCount, shownSaleId: shown?.id ?? null, shownTable: shown?.tableNumber ?? null, shownName: shown?.customerName ?? null,
      mismatch: !!shown && shown.id !== saleId,
    })
    try {
      const errBefore = useSale.getState().error
      const r = await concludeItems(saleId)
      const errAfter = useSale.getState().error
      if (errAfter && errAfter !== errBefore) track('launch_failed', { saleId, error: errAfter })
      else track('launch_ok', { saleId, printed: r.printed, queued: r.queued })
      showToast('Pedido lançado ✓', 'success')
    } finally {
      setConcluding(false)
    }
  }

  const handleFecharClick = () => {
    if (!canClose) {
      showToast('Peça a conta antes de fechar a mesa', 'warning')
      return
    }
    setShowFecharConfirm(true)
  }

  const handleConta = async () => {
    if (!saleId) return
    if ((currentSale?.guests.length ?? 0) > 0) { setShowConta(true); return }
    await emitirConta(null)
  }

  // guestId = conta de uma pessoa só; null = mesa toda
  const emitirConta = async (guestId: string | null) => {
    if (!saleId) return
    setShowConta(false)
    const shown = useSale.getState().currentSale
    track('bill', { saleId, guestId, shownSaleId: shown?.id ?? null, shownTable: shown?.tableNumber ?? null, mismatch: !!shown && shown.id !== saleId })
    const errBefore = useSale.getState().error
    await requestBill(saleId, 1, guestId)
    const errAfter = useSale.getState().error
    if (errAfter && errAfter !== errBefore) track('bill_failed', { saleId, guestId, error: errAfter })
    showToast('Comprovante enviado para impressora ✓', 'success')
    navigate(`/pagamento/${saleId}${guestId ? `?guest=${guestId}` : ''}`)
  }

  const handleAddGuest = async (name: string) => {
    if (!saleId) return
    track('guest_add', { saleId, name })
    await addGuest(saleId, name)
    setAddingGuest(false)
    const created = useSale.getState().currentSale?.guests.find(g => g.name === name)
    if (created) setTargetGuest(created.id)
    showToast(`${name} adicionado ✓`, 'success')
  }

  const handleRenameGuest = async (guest: SaleGuestDTO, name: string) => {
    if (!saleId) return
    track('guest_rename', { saleId, guestId: guest.id, from: guest.name, to: name })
    await renameGuest(saleId, guest.id, name)
    setEditingGuest(null)
  }

  const handleRemoveGuest = async (guest: SaleGuestDTO) => {
    if (!saleId) return
    track('guest_remove', { saleId, guestId: guest.id, name: guest.name })
    await removeGuest(saleId, guest.id)
    setEditingGuest(null)
    if (targetGuest === guest.id) setTargetGuest(null)
    showToast(`${guest.name} removido — itens voltaram para a mesa`, 'warning')
  }

  const handleMoveItem = async (item: SaleItemDTO, guestId: string | null) => {
    if (!saleId) return
    setMovingItem(null)
    track('item_move', { saleId, itemId: item.id, from: item.guestId, to: guestId })
    await moveItem(saleId, item.id, guestId)
  }

  const handleFecharMesa = async () => {
    if (!saleId) return
    track('close_table', { saleId })
    await cancelSale(saleId)
    navigate('/mesa')
  }

  const sale = currentSale
  const activeItems = sale?.items.filter((i) => !i.cancelled) ?? []
  const pendingCount = activeItems.filter((i) => !i.sentToProduction).length
  const canClose = activeItems.length === 0 || sale?.status === 'awaiting_payment'

  const guests = sale?.guests ?? []
  const hasGuests = guests.length > 0
  // Faixa de pessoas aparece se a função está ligada ou se a mesa já tem pessoas
  const showGuestBar = features.guests || hasGuests
  const guestName = (id: string | null) => (id ? guests.find(g => g.id === id)?.name ?? null : null)
  const targetGuestName = targetGuest ? guestName(targetGuest) : null
  const shares = sale ? computeShares(sale) : null

  // Pessoa selecionada foi removida (por este ou outro aparelho): volta para a mesa
  useEffect(() => {
    if (targetGuest && !guests.some(g => g.id === targetGuest)) setTargetGuest(null)
  }, [guests, targetGuest])

  // ── Shared sub-panels ──────────────────────────────────────

  const TopBar = () => (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
      <button onClick={() => navigate('/mesa')} className="text-slate-400 hover:text-slate-200 touch-btn">
        <ArrowLeft size={22} />
      </button>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="bg-emerald-700 text-white px-3 py-1 rounded-full text-sm font-bold shrink-0">
          Mesa {sale?.tableNumber ?? '—'}
        </span>
        {sale?.customerName && (
          <span className="text-slate-200 text-sm font-medium truncate">{sale.customerName}</span>
        )}
        {sale?.status === 'awaiting_payment' && (
          <span className="bg-amber-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold shrink-0">
            aguardando pagamento
          </span>
        )}
        <button
          onClick={() => setEditingNome(true)}
          className="text-slate-500 hover:text-slate-300 touch-btn shrink-0 ml-auto"
          title="Editar nome"
        >
          <Pencil size={14} />
        </button>
      </div>
      <span className="text-slate-500 text-xs shrink-0">{saleOperator?.name}</span>
    </div>
  )

  // Faixa "Mesa / Victor / Adriana / +": quem recebe os próximos itens
  const GuestBar = () => showGuestBar ? (
    <div className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-800/80 border-b border-slate-700 overflow-x-auto shrink-0">
      <span className="text-[10px] uppercase text-slate-500 shrink-0 mr-1">Lançar para</span>
      <button
        onClick={() => setTargetGuest(null)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold touch-btn shrink-0
          ${targetGuest === null ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
      >
        <Users size={12} /> Mesa
      </button>
      {guests.map(g => (
        <button
          key={g.id}
          onClick={() => targetGuest === g.id ? setEditingGuest(g) : setTargetGuest(g.id)}
          title={targetGuest === g.id ? 'Toque de novo para editar' : undefined}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold touch-btn shrink-0 max-w-[9rem] truncate
            ${targetGuest === g.id ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
        >
          {g.name}
        </button>
      ))}
      {features.guests && (
        <button
          onClick={() => setAddingGuest(true)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold touch-btn shrink-0 border border-dashed border-slate-500 text-slate-400 hover:text-slate-200 hover:border-slate-300"
        >
          <UserPlus size={12} /> Pessoa
        </button>
      )}
    </div>
  ) : null

  // Itens agrupados por pessoa (itens da mesa primeiro) quando há pessoas
  const groupedItems = (): { key: string; label: string | null; guestId: string | null; items: SaleItemDTO[] }[] => {
    if (!hasGuests) return [{ key: 'all', label: null, guestId: null, items: activeItems }]
    const groups = [{ key: 'mesa', label: 'Mesa', guestId: null as string | null, items: activeItems.filter(i => !i.guestId || !guests.some(g => g.id === i.guestId)) }]
    for (const g of guests) groups.push({ key: g.id, label: g.name, guestId: g.id, items: activeItems.filter(i => i.guestId === g.id) })
    return groups.filter(gr => gr.items.length > 0 || gr.guestId !== null)
  }

  const ItemList = () => (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {activeItems.length === 0 && !hasGuests ? (
        <div className="text-slate-600 text-sm p-4 text-center">
          {isPOS ? 'Vá para "Produtos" para adicionar itens.' : 'Nenhum item ainda. Toque nos produtos ao lado.'}
        </div>
      ) : (
        groupedItems().map((group) => (
        <div key={group.key} className="space-y-1">
          {group.label && (
            <div className={`flex items-center justify-between px-2 pt-2 pb-0.5 text-xs font-semibold ${group.guestId ? 'text-sky-300' : 'text-emerald-300'}`}>
              <span className="flex items-center gap-1.5 truncate">
                {group.guestId ? null : <Users size={12} />}
                {group.label}
                {group.guestId === targetGuest && <span className="text-[9px] uppercase bg-slate-700 text-slate-300 px-1.5 rounded-full">recebendo</span>}
              </span>
              <span className="text-slate-400 font-normal">
                {group.items.length === 0 ? 'sem itens' : fmtBRL(group.items.reduce((s, i) => s + i.subtotal, 0))}
              </span>
            </div>
          )}
          {group.items.map((item, idx) => (
          <div key={item.id} className={`flex items-center gap-2 px-2 py-2 rounded-lg ${item.sentToProduction ? 'bg-slate-800/50' : 'bg-slate-800'}`}>
            <span className="text-slate-600 text-xs w-5 shrink-0">{idx + 1}</span>
            <button
              onClick={() => hasGuests && setMovingItem(item)}
              disabled={!hasGuests}
              className="flex-1 min-w-0 text-left disabled:cursor-default"
              title={hasGuests ? 'Toque para mover para outra pessoa' : undefined}
            >
              <div className="text-sm text-slate-200 truncate font-medium flex items-center gap-1.5">
                <span className="truncate">{item.productName}</span>
                {hasGuests && <ArrowRightLeft size={11} className="text-slate-500 shrink-0" />}
              </div>
              <div className="text-xs text-slate-500">{item.qty} × {fmtBRL(item.unitPrice)}</div>
            </button>
            {item.sentToProduction
              ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <Check size={14} className="text-emerald-400" />
                  <button
                    onClick={() => setCancelingItem(item)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-rose-900/40 hover:bg-rose-700 active:bg-rose-600 text-rose-400 hover:text-white touch-btn"
                  ><X size={16} /></button>
                </div>
              )
              : (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => removeItem(saleId!, item.id)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-rose-700 active:bg-rose-600 text-slate-300 hover:text-white touch-btn"
                  ><Minus size={16} /></button>
                  <button
                    onClick={() => handleAddProduct(item.productId, 1, item.guestId ?? null)}
                    disabled={addingItem === item.productId}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-700 hover:bg-emerald-700 active:bg-emerald-600 text-slate-300 hover:text-white disabled:opacity-40 touch-btn"
                  ><Plus size={16} /></button>
                </div>
              )
            }
            <span className="text-sm font-semibold text-slate-300 shrink-0 w-16 text-right">{fmtBRL(item.subtotal)}</span>
          </div>
          ))}
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
      {sale?.perPersonAmount != null && sale.peopleCount != null && !hasGuests && (
        <div className="text-xs text-amber-400 mt-1">{fmtBRL(sale.perPersonAmount)} / pessoa ({sale.peopleCount} pessoas)</div>
      )}
      {hasGuests && shares && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
          {shares.guests.map(g => (
            <span key={g.guestId}>
              <span className="text-sky-300">{g.name}</span> {fmtBRL(g.totalCents / 100)}
              {g.paidCents > 0 && <span className="text-emerald-400"> ✓</span>}
            </span>
          ))}
          {shares.sharedCents > 0 && <span className="text-slate-500">mesa {fmtBRL(shares.sharedCents / 100)}</span>}
        </div>
      )}
    </div>
  )

  const ActionBar = ({ tablet }: { tablet?: boolean }) => (
    <div className={`${tablet ? 'grid grid-cols-4' : 'grid grid-cols-2'} gap-1 p-2 bg-slate-800 border-t border-slate-700 shrink-0`}>
      {[
        { icon: Receipt,        label: 'Conta',    action: handleConta,      active: sale?.status !== 'awaiting_payment', locked: false },
        { icon: DoorOpen,       label: 'Fechar',   action: handleFecharClick, active: true,                              locked: !canClose },
        { icon: ArrowRightLeft, label: 'Transf.',  action: () => {},         active: false,                              locked: false },
        { icon: CheckCheck,     label: 'Lançar',   action: handleConcluir,   active: pendingCount > 0 && !concluding,     locked: false },
      ].map(({ icon: Icon, label, action, active, locked }) => (
        <button key={label} onClick={action} disabled={!active}
          className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg text-[10px] touch-btn
            ${locked
              ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
              : active
              ? label === 'Lançar' ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
              : label === 'Pagar' ? 'bg-blue-700 hover:bg-blue-600 text-white'
              : label === 'Fechar' ? 'bg-rose-800 hover:bg-rose-700 text-white'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}>
          {label === 'Lançar' && concluding
            ? <Loader size={18} className="animate-spin" />
            : <Icon size={18} />}
          <span className="leading-tight text-center">{label}</span>
          {label === 'Lançar' && pendingCount > 0 && (
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
          <button key={prod.id} onClick={() => setPendingProduct(prod)}
            className="flex flex-col items-start p-3 rounded-lg border text-left touch-btn bg-slate-800 border-slate-700 hover:bg-slate-700 active:bg-slate-600">
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
        <GuestBar />
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
        {cancelingItem && <CancelItemDialog
          item={cancelingItem}
          onConfirm={async () => { const snap = cancelingItem; setCancelingItem(null); track('cancel_item', { saleId, itemId: snap.id, productId: snap.productId, qty: snap.qty, sent: snap.sentToProduction }); await cancelItem(saleId!, snap.id); showToast(snap.sentToProduction && snap.sendToKitchen ? 'Item cancelado — aviso enviado para cozinha' : 'Item cancelado', 'warning') }}
          onClose={() => setCancelingItem(null)}
        />}
        {pendingProduct && <AddQtyDialog
          product={pendingProduct}
          guestName={showGuestBar ? targetGuestName : undefined}
          onConfirm={async (qty) => { const prod = pendingProduct; setPendingProduct(null); await handleAddProduct(prod.id, qty) }}
          onClose={() => setPendingProduct(null)}
        />}
        {editingNome && <EditNomeDialog
          current={sale?.customerName ?? ''}
          onSave={handleSaveNome}
          onClose={() => setEditingNome(false)}
        />}
        {addingGuest && <GuestNameDialog title="Nova pessoa na mesa" onSave={handleAddGuest} onClose={() => setAddingGuest(false)} />}
        {editingGuest && <GuestNameDialog
          title="Editar pessoa"
          current={editingGuest.name}
          onSave={(name) => handleRenameGuest(editingGuest, name)}
          onRemove={() => handleRemoveGuest(editingGuest)}
          onClose={() => setEditingGuest(null)}
        />}
        {movingItem && <MoveItemDialog item={movingItem} guests={guests} onMove={(gid) => handleMoveItem(movingItem, gid)} onClose={() => setMovingItem(null)} />}
        {showConta && shares && <ContaDialog guests={guests} shares={shares} onPick={emitirConta} onClose={() => setShowConta(false)} />}
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
          <GuestBar />
          <ItemList />
          <Totals />
          <ActionBar tablet />
        </div>
        <ProductPanel />
      </div>
      {showFecharConfirm && <FecharMesaDialog onConfirm={handleFecharMesa} onClose={() => setShowFecharConfirm(false)} />}
      {cancelingItem && <CancelItemDialog
        item={cancelingItem}
        onConfirm={async () => { const snap = cancelingItem; setCancelingItem(null); track('cancel_item', { saleId, itemId: snap.id, productId: snap.productId, qty: snap.qty, sent: snap.sentToProduction }); await cancelItem(saleId!, snap.id); showToast(snap.sentToProduction && snap.sendToKitchen ? 'Item cancelado — aviso enviado para cozinha' : 'Item cancelado', 'warning') }}
        onClose={() => setCancelingItem(null)}
      />}
      {pendingProduct && <AddQtyDialog
        product={pendingProduct}
        guestName={showGuestBar ? targetGuestName : undefined}
        onConfirm={async (qty) => { const prod = pendingProduct; setPendingProduct(null); await handleAddProduct(prod.id, qty) }}
        onClose={() => setPendingProduct(null)}
      />}
      {editingNome && <EditNomeDialog
        current={sale?.customerName ?? ''}
        onSave={handleSaveNome}
        onClose={() => setEditingNome(false)}
      />}
      {addingGuest && <GuestNameDialog title="Nova pessoa na mesa" onSave={handleAddGuest} onClose={() => setAddingGuest(false)} />}
      {editingGuest && <GuestNameDialog
        title="Editar pessoa"
        current={editingGuest.name}
        onSave={(name) => handleRenameGuest(editingGuest, name)}
        onRemove={() => handleRemoveGuest(editingGuest)}
        onClose={() => setEditingGuest(null)}
      />}
      {movingItem && <MoveItemDialog item={movingItem} guests={guests} onMove={(gid) => handleMoveItem(movingItem, gid)} onClose={() => setMovingItem(null)} />}
      {showConta && shares && <ContaDialog guests={guests} shares={shares} onPick={emitirConta} onClose={() => setShowConta(false)} />}
    </div>
  )
}
