import { Delete } from 'lucide-react'

interface Props {
  cents: number        // value in centavos
  onChange: (cents: number) => void
  disabled?: boolean
  className?: string
}

// Brazilian POS-style currency keypad: digits shift left (cents-first).
// e.g. typing 5, 0, 0, 0 → R$ 50,00
export function CurrencyKeypad({ cents, onChange, disabled = false, className = '' }: Props) {
  const handle = (key: string) => {
    if (disabled) return
    if (key === 'C') { onChange(0); return }
    if (key === '⌫') { onChange(Math.floor(cents / 10)); return }
    if (key === ',') return // no-op, always 2 decimal places
    const next = cents * 10 + Number(key)
    if (next > 9_999_99) return // max R$ 9.999,99
    onChange(next)
  }

  const rows = [
    ['7', '8', '9'],
    ['4', '5', '6'],
    ['1', '2', '3'],
    ['C', '0', '⌫'],
  ]

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-2 flex-1">
          {row.map((key) => (
            <button
              key={key}
              onClick={() => handle(key)}
              disabled={disabled}
              className="
                flex-1 rounded-xl text-3xl font-semibold
                bg-slate-700 hover:bg-slate-600 active:bg-slate-500
                text-slate-100 touch-btn flex items-center justify-center
                disabled:opacity-40
              "
            >
              {key === '⌫' ? <Delete size={26} /> : key}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
