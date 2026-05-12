import type { TableDTO } from '@pdv/shared'

interface Props {
  table: TableDTO
  onClick: () => void
  compact?: boolean
}

function formatElapsed(openedAt: string): string {
  const diff = Date.now() - new Date(openedAt).getTime()
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h ${mins % 60}m`
  if (hours > 0) return `${hours}h ${mins % 60}m`
  if (mins > 0) return `${mins}m`
  return 'agora'
}

const STATUS_STYLES = {
  free: 'bg-slate-700 border-slate-600 text-slate-400',
  open: 'bg-emerald-900 border-emerald-600 text-emerald-100',
  awaiting_payment: 'bg-amber-900 border-amber-500 text-amber-100',
}

export function MesaCard({ table, onClick, compact = false }: Props) {
  const style = STATUS_STYLES[table.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.free
  const isActive = table.status !== 'free'
  const firstName = table.customerName?.split(' ')[0] ?? null

  return (
    <button
      onClick={onClick}
      className={`
        ${style}
        border-2 rounded-xl flex flex-col items-center justify-center
        touch-btn aspect-square
        transition-colors duration-150
        ${compact ? 'p-1.5 min-w-[60px]' : 'p-3 min-w-[80px]'}
      `}
    >
      {isActive && firstName ? (
        <>
          <span className={`opacity-60 leading-none ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
            {compact ? `#${table.number}` : `Mesa ${table.number}`}
          </span>
          <span className={`font-bold leading-tight truncate w-full text-center ${compact ? 'text-sm' : 'text-xl'}`}>
            {firstName}
          </span>
        </>
      ) : (
        <span className={`font-bold leading-none ${compact ? 'text-xl' : 'text-3xl'}`}>{table.number}</span>
      )}
      {isActive && table.openedAt && (
        <span className={`opacity-70 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>{formatElapsed(table.openedAt)}</span>
      )}
      {table.status === 'awaiting_payment' && (
        <span className={`font-semibold opacity-90 ${compact ? 'text-[8px]' : 'text-[10px]'}`}>conta</span>
      )}
    </button>
  )
}
