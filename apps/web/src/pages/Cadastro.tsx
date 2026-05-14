import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Plus, Pencil, Trash2, X, Check,
  ShoppingBag, Tag, LayoutGrid, Users,
} from 'lucide-react'
import { api } from '../lib/api'

// ─── Types ───────────────────────────────────────────────────

interface Category { id: string; name: string; color: string; icon: string; displayOrder: number; active: boolean }
interface Product { id: string; categoryId: string; name: string; price: number; isFavorite: boolean; sendToKitchen: boolean; active: boolean; category: { id: string; name: string; color: string } }
interface TableRow { id: string; number: number; status: string }
interface UserRow { id: string; name: string; role: string; active: boolean }

type Tab = 'produtos' | 'categorias' | 'mesas' | 'usuarios'

const COLOR_PRESETS = ['#F59E0B','#3B82F6','#10B981','#6B7280','#EF4444','#8B5CF6','#EC4899','#F97316','#06B6D4','#84CC16']
const ICON_OPTIONS = ['Star','Ticket','Flame','UtensilsCrossed','Coffee','ShoppingBasket','Beer','Sandwich','Pizza','Wine','Apple','ChefHat','Beef','Fish','Salad']
const ROLES = ['admin','operator','waiter'] as const
const ROLE_LABELS: Record<string, string> = { admin:'Admin', operator:'Operador', waiter:'Garçom' }
const ROLE_COLORS: Record<string, string> = { admin:'bg-rose-900 text-rose-300', operator:'bg-blue-900 text-blue-300', waiter:'bg-emerald-900 text-emerald-300' }
const STATUS_LABELS: Record<string, string> = { free:'Livre', open:'Aberta', awaiting_payment:'Aguard. Pag.' }

function fmtBRL(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

// ─── Modal wrapper ────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <span className="font-bold text-slate-100">{title}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 touch-btn"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto p-5 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-slate-400 font-semibold uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 user-select-text"
    />
  )
}

function SaveBtn({ onClick, disabled, label = 'Salvar' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold touch-btn disabled:opacity-40">
      {label}
    </button>
  )
}

// ─── PRODUTOS tab ─────────────────────────────────────────────

function ProdutosTab({ categories }: { categories: Category[] }) {
  const [items, setItems] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Product | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ categoryId: '', name: '', price: '', isFavorite: false, sendToKitchen: true })

  const load = () => api.get<Product[]>('/admin/products').then(setItems)
  useEffect(() => { load() }, [])

  const filtered = items.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  const openAdd = () => { setForm({ categoryId: categories[0]?.id ?? '', name: '', price: '', isFavorite: false, sendToKitchen: true }); setAdding(true) }
  const openEdit = (p: Product) => { setForm({ categoryId: p.categoryId, name: p.name, price: String(p.price), isFavorite: p.isFavorite, sendToKitchen: p.sendToKitchen }); setEditing(p) }

  const save = async () => {
    const data = { ...form, price: Number(form.price) }
    if (editing) { await api.patch(`/admin/products/${editing.id}`, data); setEditing(null) }
    else { await api.post('/admin/products', data); setAdding(false) }
    load()
  }

  const toggle = async (p: Product) => { await api.patch(`/admin/products/${p.id}`, { active: !p.active }); load() }

  const FormContent = () => (
    <>
      <Field label="Categoria">
        <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
          className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500">
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Nome"><TextInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Nome do produto" /></Field>
      <Field label="Preço (R$)"><TextInput value={form.price} onChange={v => setForm(f => ({ ...f, price: v }))} placeholder="0.00" type="number" /></Field>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={form.isFavorite} onChange={e => setForm(f => ({ ...f, isFavorite: e.target.checked }))} className="accent-amber-400" />
          Favorito (aparece na aba Favoritos)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
          <input type="checkbox" checked={form.sendToKitchen} onChange={e => setForm(f => ({ ...f, sendToKitchen: e.target.checked }))} className="accent-emerald-500" />
          Enviar para cozinha ao concluir pedido
        </label>
      </div>
      <SaveBtn onClick={save} disabled={!form.name || !form.price || !form.categoryId} />
    </>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 p-3 shrink-0">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..."
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 user-select-text" />
        <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium touch-btn">
          <Plus size={16} /> Novo
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map(p => (
          <div key={p.id} className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 ${!p.active ? 'opacity-40' : ''}`}>
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.category.color }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-200 truncate">{p.name}</div>
              <div className="text-xs text-slate-500">{p.category.name}</div>
            </div>
            <span className="text-emerald-400 font-semibold text-sm shrink-0">{fmtBRL(p.price)}</span>
            <button onClick={() => openEdit(p)} className="text-slate-500 hover:text-slate-200 touch-btn"><Pencil size={15} /></button>
            <button onClick={() => toggle(p)} className={`touch-btn ${p.active ? 'text-slate-500 hover:text-rose-400' : 'text-slate-600 hover:text-emerald-400'}`}>
              {p.active ? <X size={15} /> : <Check size={15} />}
            </button>
          </div>
        ))}
      </div>
      {adding && <Modal title="Novo Produto" onClose={() => setAdding(false)}>{FormContent()}</Modal>}
      {editing && <Modal title="Editar Produto" onClose={() => setEditing(null)}>{FormContent()}</Modal>}
    </div>
  )
}

// ─── CATEGORIAS tab ───────────────────────────────────────────

function CategoriasTab() {
  const [items, setItems] = useState<Category[]>([])
  const [editing, setEditing] = useState<Category | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', color: COLOR_PRESETS[0]!, icon: ICON_OPTIONS[0]!, displayOrder: 1 })

  const load = () => api.get<Category[]>('/admin/categories').then(setItems)
  useEffect(() => { load() }, [])

  const openAdd = () => { setForm({ name: '', color: COLOR_PRESETS[0]!, icon: ICON_OPTIONS[0]!, displayOrder: items.length + 1 }); setAdding(true) }
  const openEdit = (c: Category) => { setForm({ name: c.name, color: c.color, icon: c.icon, displayOrder: c.displayOrder }); setEditing(c) }

  const save = async () => {
    if (editing) { await api.patch(`/admin/categories/${editing.id}`, form); setEditing(null) }
    else { await api.post('/admin/categories', form); setAdding(false) }
    load()
  }

  const toggle = async (c: Category) => { await api.patch(`/admin/categories/${c.id}`, { active: !c.active }); load() }

  const FormContent = () => (
    <>
      <Field label="Nome"><TextInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Nome da categoria" /></Field>
      <Field label="Cor">
        <div className="flex flex-wrap gap-2">
          {COLOR_PRESETS.map(c => (
            <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
              className={`w-8 h-8 rounded-lg touch-btn border-2 ${form.color === c ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
      </Field>
      <Field label="Ícone (nome Lucide)">
        <select value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
          className="bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-slate-100 text-sm focus:outline-none focus:border-emerald-500">
          {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </Field>
      <Field label="Ordem de exibição">
        <TextInput value={String(form.displayOrder)} onChange={v => setForm(f => ({ ...f, displayOrder: Number(v) }))} type="number" />
      </Field>
      <SaveBtn onClick={save} disabled={!form.name} />
    </>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end p-3 shrink-0">
        <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium touch-btn">
          <Plus size={16} /> Nova Categoria
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.map(c => (
          <div key={c.id} className={`flex items-center gap-3 px-4 py-3 border-b border-slate-800 ${!c.active ? 'opacity-40' : ''}`}>
            <div className="w-5 h-5 rounded shrink-0" style={{ backgroundColor: c.color }} />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-slate-200">{c.name}</span>
              <span className="text-xs text-slate-500 ml-2">#{c.displayOrder} · {c.icon}</span>
            </div>
            <button onClick={() => openEdit(c)} className="text-slate-500 hover:text-slate-200 touch-btn"><Pencil size={15} /></button>
            <button onClick={() => toggle(c)} className={`touch-btn ${c.active ? 'text-slate-500 hover:text-rose-400' : 'text-slate-600 hover:text-emerald-400'}`}>
              {c.active ? <X size={15} /> : <Check size={15} />}
            </button>
          </div>
        ))}
      </div>
      {adding && <Modal title="Nova Categoria" onClose={() => setAdding(false)}>{FormContent()}</Modal>}
      {editing && <Modal title="Editar Categoria" onClose={() => setEditing(null)}>{FormContent()}</Modal>}
    </div>
  )
}

// ─── MESAS tab ────────────────────────────────────────────────

function MesasTab() {
  const [items, setItems] = useState<TableRow[]>([])
  const [newNum, setNewNum] = useState('')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [err, setErr] = useState('')

  const load = () => api.get<TableRow[]>('/admin/tables').then(setItems)
  useEffect(() => { load() }, [])

  const add = async () => {
    setErr('')
    try {
      await api.post('/admin/tables', { number: Number(newNum) })
      setNewNum(''); setAdding(false); load()
    } catch (e) { setErr((e as Error).message) }
  }

  const remove = async (id: string) => {
    setErr('')
    try {
      await api.delete(`/admin/tables/${id}`)
      setRemoving(null); load()
    } catch (e) { setErr((e as Error).message) }
  }

  const statusColor: Record<string, string> = {
    free: 'text-slate-500',
    open: 'text-emerald-400',
    awaiting_payment: 'text-amber-400',
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 shrink-0">
        {err && <span className="text-rose-400 text-xs flex-1">{err}</span>}
        <div className="flex-1" />
        {adding ? (
          <>
            <input value={newNum} onChange={e => setNewNum(e.target.value)} placeholder="Número" type="number" min="1"
              className="w-24 bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-emerald-500 user-select-text" />
            <button onClick={add} className="px-3 py-2 rounded-xl bg-emerald-700 text-white text-sm touch-btn">OK</button>
            <button onClick={() => setAdding(false)} className="px-3 py-2 rounded-xl bg-slate-700 text-slate-400 text-sm touch-btn">Cancelar</button>
          </>
        ) : (
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium touch-btn">
            <Plus size={16} /> Nova Mesa
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-4 gap-2 p-3">
          {items.map(t => (
            <div key={t.id} className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-slate-200">{t.number}</span>
              <span className={`text-xs font-medium ${statusColor[t.status] ?? 'text-slate-500'}`}>
                {STATUS_LABELS[t.status] ?? t.status}
              </span>
              {t.status === 'free' && (
                <button onClick={() => setRemoving(t.id)} className="text-slate-600 hover:text-rose-400 touch-btn mt-1"><Trash2 size={13} /></button>
              )}
            </div>
          ))}
        </div>
      </div>
      {removing && (
        <Modal title="Remover Mesa" onClose={() => setRemoving(null)}>
          <p className="text-slate-400 text-sm">Tem certeza que deseja remover esta mesa?</p>
          <div className="flex gap-3">
            <button onClick={() => setRemoving(null)} className="flex-1 py-3 rounded-xl bg-slate-700 text-slate-300 touch-btn">Cancelar</button>
            <button onClick={() => remove(removing)} className="flex-1 py-3 rounded-xl bg-rose-700 hover:bg-rose-600 text-white font-bold touch-btn">Remover</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── USUÁRIOS tab ─────────────────────────────────────────────

function UsuariosTab() {
  const [items, setItems] = useState<UserRow[]>([])
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', pin: '', role: 'operator' })

  const load = () => api.get<UserRow[]>('/admin/users').then(setItems)
  useEffect(() => { load() }, [])

  const openAdd = () => { setForm({ name: '', pin: '', role: 'operator' }); setAdding(true) }
  const openEdit = (u: UserRow) => { setForm({ name: u.name, pin: '', role: u.role }); setEditing(u) }

  const save = async () => {
    if (editing) {
      const payload: Record<string, unknown> = { name: form.name, role: form.role }
      if (form.pin) payload.pin = form.pin
      await api.patch(`/admin/users/${editing.id}`, payload)
      setEditing(null)
    } else {
      await api.post('/admin/users', form)
      setAdding(false)
    }
    load()
  }

  const toggle = async (u: UserRow) => { await api.patch(`/admin/users/${u.id}`, { active: !u.active }); load() }

  const FormContent = ({ isEdit }: { isEdit: boolean }) => (
    <>
      <Field label="Nome"><TextInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Nome do operador" /></Field>
      <Field label={isEdit ? 'Novo PIN (deixe vazio para manter)' : 'PIN (4 dígitos)'}>
        <TextInput value={form.pin} onChange={v => setForm(f => ({ ...f, pin: v }))} placeholder={isEdit ? 'Opcional' : '1234'} type="password" />
      </Field>
      <Field label="Perfil">
        <div className="flex gap-2">
          {ROLES.map(r => (
            <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
              className={`flex-1 py-2 rounded-lg text-sm font-medium touch-btn border-2 ${form.role === r ? ROLE_COLORS[r] + ' border-current' : 'border-slate-700 text-slate-500'}`}>
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </Field>
      <SaveBtn onClick={save} disabled={!form.name || (!isEdit && !form.pin)} />
    </>
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-end p-3 shrink-0">
        <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium touch-btn">
          <Plus size={16} /> Novo Usuário
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.map(u => (
          <div key={u.id} className={`flex items-center gap-3 px-4 py-3 border-b border-slate-800 ${!u.active ? 'opacity-40' : ''}`}>
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-200">{u.name}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role] ?? 'bg-slate-700 text-slate-400'}`}>
                {ROLE_LABELS[u.role] ?? u.role}
              </span>
            </div>
            <button onClick={() => openEdit(u)} className="text-slate-500 hover:text-slate-200 touch-btn"><Pencil size={15} /></button>
            <button onClick={() => toggle(u)} className={`touch-btn ${u.active ? 'text-slate-500 hover:text-rose-400' : 'text-slate-600 hover:text-emerald-400'}`}>
              {u.active ? <X size={15} /> : <Check size={15} />}
            </button>
          </div>
        ))}
      </div>
      {adding && <Modal title="Novo Usuário" onClose={() => setAdding(false)}>{FormContent({ isEdit: false })}</Modal>}
      {editing && <Modal title="Editar Usuário" onClose={() => setEditing(null)}>{FormContent({ isEdit: true })}</Modal>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: 'produtos',   label: 'Produtos',   icon: ShoppingBag },
  { id: 'categorias', label: 'Categorias', icon: Tag },
  { id: 'mesas',      label: 'Mesas',      icon: LayoutGrid },
  { id: 'usuarios',   label: 'Usuários',   icon: Users },
]

export default function Cadastro() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('produtos')
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    api.get<Category[]>('/admin/categories').then(setCategories)
  }, [])

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200 touch-btn">
          <ArrowLeft size={22} />
        </button>
        <span className="text-slate-200 font-medium flex-1">Cadastro</span>
      </div>

      {/* Tab bar */}
      <div className="flex bg-slate-800 border-b border-slate-700 shrink-0">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium touch-btn transition-colors ${
              tab === id ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {tab === 'produtos'   && <ProdutosTab categories={categories} />}
        {tab === 'categorias' && <CategoriasTab />}
        {tab === 'mesas'      && <MesasTab />}
        {tab === 'usuarios'   && <UsuariosTab />}
      </div>
    </div>
  )
}
