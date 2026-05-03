import type { TableDTO } from '@pdv/shared'

interface Props {
  table: TableDTO
  onClick: () => void
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

export function MesaCard({ table, onClick }: Props) {
  const style = STATUS_STYLES[table.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.free
  const isActive = table.status !== 'free'

  return (
    <button
      onClick={onClick}
      className={`
        ${style}
        border-2 rounded-xl p-3 flex flex-col items-center justify-center
        touch-btn min-w-[80px] aspect-square
        transition-colors duration-150
      `}
    >
      <span className="text-3xl font-bold leading-none">{table.number}</span>
      {isActive && table.openedAt && (
        <span className="text-xs mt-1 opacity-80">{formatElapsed(table.openedAt)}</span>
      )}
      {table.status === 'awaiting_payment' && (
        <span className="text-[10px] mt-1 font-semibold opacity-90">conta</span>
      )}
    </button>
  )
}
