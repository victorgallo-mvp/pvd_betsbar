import { useEffect, useRef, useState } from 'react'

interface MenuProduct {
  name: string
  price: number
}

interface MenuCategory {
  id: string
  name: string
  icon: string
  color: string
  products: MenuProduct[]
}

const BASE = import.meta.env.VITE_API_URL ?? '/api'

function fmtBRL(price: number) {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function Cardapio() {
  const [categories, setCategories] = useState<MenuCategory[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    fetch(`${BASE}/menu`)
      .then((r) => {
        if (!r.ok) throw new Error()
        return r.json() as Promise<MenuCategory[]>
      })
      .then((data) => {
        setCategories(data)
        if (data.length > 0) setActive(data[0]!.id)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const scrollTo = (id: string) => {
    setActive(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    if (categories.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.getAttribute('data-cat-id'))
          }
        }
      },
      { threshold: 0.3 },
    )
    for (const cat of categories) {
      const el = sectionRefs.current[cat.id]
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [categories])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Carregando cardápio...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-slate-400 text-lg font-semibold mb-2">Ops!</div>
          <div className="text-slate-500 text-sm">Não foi possível carregar o cardápio.<br />Tente novamente em instantes.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-6 pb-4">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold text-emerald-400 tracking-tight">Bet's Bar</h1>
          <p className="text-slate-500 text-xs mt-0.5">Cardápio</p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-lg mx-auto overflow-x-auto scrollbar-none">
          <div className="flex gap-1 px-3 py-2 w-max">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => scrollTo(cat.id)}
                className={`
                  px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150
                  ${active === cat.id
                    ? 'text-slate-900'
                    : 'text-slate-400 bg-slate-800 hover:text-slate-200'
                  }
                `}
                style={active === cat.id ? { backgroundColor: cat.color } : undefined}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Product list */}
      <div className="flex-1 max-w-lg mx-auto w-full px-3 py-4 flex flex-col gap-6">
        {categories.map((cat) => (
          <div
            key={cat.id}
            data-cat-id={cat.id}
            ref={(el) => { sectionRefs.current[cat.id] = el }}
          >
            {/* Category header */}
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-1 h-5 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <h2 className="text-slate-200 font-bold text-base">{cat.name}</h2>
            </div>

            {/* Products */}
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden">
              {cat.products.map((product, i) => (
                <div
                  key={product.name}
                  className={`
                    flex items-center justify-between px-4 py-3
                    ${i < cat.products.length - 1 ? 'border-b border-slate-800' : ''}
                  `}
                >
                  <span className="text-slate-200 text-sm">{product.name}</span>
                  <span className="text-emerald-400 font-bold text-sm tabular-nums shrink-0 ml-4">
                    {fmtBRL(product.price)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <p className="text-slate-700 text-xs text-center pb-4">
          Preços sujeitos a alteração sem aviso prévio.
        </p>
      </div>
    </div>
  )
}
