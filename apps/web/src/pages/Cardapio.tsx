import { useState } from 'react'
import { FileDown } from 'lucide-react'

const TABS = [
  { id: 'bebidas', label: 'Bebidas', src: '/menu/bebidas.pdf' },
  { id: 'drinks',  label: 'Drinks',  src: '/menu/drinks.pdf'  },
  { id: 'comidas', label: 'Comidas', src: '/menu/comidas.pdf' },
]

export default function Cardapio() {
  const [active, setActive] = useState('bebidas')
  const current = TABS.find((t) => t.id === active)!

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 pt-5 pb-3 shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-emerald-400 tracking-tight">Bet's Bar</h1>
            <p className="text-slate-500 text-xs mt-0.5">Cardápio</p>
          </div>
          <a
            href={current.src}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium"
          >
            <FileDown size={14} />
            Abrir
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="max-w-2xl mx-auto flex gap-1 px-4 py-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`
                px-5 py-2 rounded-full text-sm font-semibold transition-all duration-150
                ${active === tab.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 bg-slate-800'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* PDF viewer */}
      <div className="flex-1 max-w-2xl w-full mx-auto overflow-hidden">
        <object
          key={current.id}
          data={current.src}
          type="application/pdf"
          className="w-full h-full"
        >
          {/* Fallback para browsers que não renderizam PDF inline (ex: Android Chrome) */}
          <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
            <p className="text-slate-400 text-sm">
              Seu navegador não suporta visualização de PDF.
            </p>
            <a
              href={current.src}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm"
            >
              <FileDown size={18} />
              Abrir cardápio — {current.label}
            </a>
          </div>
        </object>
      </div>
    </div>
  )
}
