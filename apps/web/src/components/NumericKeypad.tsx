import { Delete } from 'lucide-react'

interface Props {
  value: string
  onChange: (v: string) => void
  maxLength?: number
  disabled?: boolean
  onConfirm?: () => void
  confirmLabel?: string
}

// Simple integer keypad used for mesa number entry.
// For currency amounts, use CurrencyKeypad.
export function NumericKeypad({
  value,
  onChange,
  maxLength = 3,
  disabled = false,
  onConfirm,
  confirmLabel = 'OK',
}: Props) {
  const handle = (key: string) => {
    if (disabled) return
    if (key === 'C') { onChange(''); return }
    if (key === '⌫') { onChange(value.slice(0, -1)); return }
    if (value.length >= maxLength) return
    onChange(value + key)
  }

  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['C', '0', '⌫'],
  ]

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-2">
          {row.map((key) => (
            <button
              key={key}
              onClick={() => handle(key)}
              disabled={disabled}
              className="
                flex-1 aspect-square rounded-xl text-xl font-semibold
                bg-slate-700 hover:bg-slate-600 active:bg-slate-500
                text-slate-100 touch-btn flex items-center justify-center
                disabled:opacity-40
              "
            >
              {key === '⌫' ? <Delete size={20} /> : key}
            </button>
          ))}
        </div>
      ))}
      {onConfirm && (
        <button
          onClick={onConfirm}
          disabled={disabled || !value}
          className="
            w-full py-3 rounded-xl text-xl font-bold
            bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700
            text-white touch-btn
            disabled:opacity-40
          "
        >
          {confirmLabel}
        </button>
      )}
    </div>
  )
}
