import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Search, X } from 'lucide-react'
import type { ProductDTO, CategoryDTO } from '@pdv/shared'

export default function Consulta() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<ProductDTO[]>([])
  const [categories, setCategories] = useState<CategoryDTO[]>([])
  const [search, setSearch] = useState('')
  const [catId, setCatId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ]).then(([prods, cats]) => {
      setProducts(prods)
      setCategories(cats)
      setIsLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.active)
    if (catId) list = list.filter((p) => p.categoryId === catId)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }
    return list
  }, [products, catId, search])

  const formatPrice = (price: number) =>
    price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
        <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200 touch-btn">
          <ArrowLeft size={22} />
        </button>
        <span className="text-emerald-400 font-bold flex-1">Consulta de Produtos</span>
      </div>

      {/* Search */}
      <div className="px-4 py-3 shrink-0">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="px-4 pb-2 flex gap-2 overflow-x-auto shrink-0 scrollbar-none">
        <button
          onClick={() => setCatId(null)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
            catId === null
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Todos
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatId(catId === c.id ? null : c.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
              catId === c.id
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* Product list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading ? (
          <div className="text-slate-500 text-sm animate-pulse py-8 text-center">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-slate-600 text-sm text-center py-8">Nenhum produto encontrado</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((p) => {
              const cat = categories.find((c) => c.id === p.categoryId)
              return (
                <div
                  key={p.id}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-3 flex flex-col gap-1"
                >
                  {cat && (
                    <span className="text-xs text-slate-500">
                      {cat.icon} {cat.name}
                    </span>
                  )}
                  <span className="text-slate-100 font-medium text-sm leading-snug">{p.name}</span>
                  <span className="text-emerald-400 font-bold text-base mt-auto">
                    {formatPrice(p.price)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
