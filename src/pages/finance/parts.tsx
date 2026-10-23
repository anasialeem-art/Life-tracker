import type { FinCategory, FinTx } from '../../lib/db'
import { CATEGORY_META, formatEUR } from '../../lib/finance'

export function CategoryBadge({ category, size = 40 }: { category: FinCategory | null; size?: number }) {
  const meta = category ? CATEGORY_META[category] : null
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[12px]"
      style={{
        width: size, height: size, fontSize: size * 0.46,
        background: meta ? `color-mix(in srgb, ${meta.color} 16%, transparent)` : 'var(--warning-soft)',
      }}>
      {meta ? meta.icon : <span className="text-[17px] font-bold text-warning">?</span>}
    </span>
  )
}

/** Day label for transaction lists: "Today", "Yesterday", "Mon 20 Oct". */
export function dayHeading(day: string, today: string): string {
  if (day === today) return 'Today'
  const d = new Date(`${day}T12:00:00`)
  const t = new Date(`${today}T12:00:00`)
  if (Math.round((t.getTime() - d.getTime()) / 86_400_000) === 1) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' })
}

export function txTitle(t: Pick<FinTx, 'payee' | 'purpose'>): string {
  return t.payee || t.purpose || 'Transaction'
}

export function TxRow({ tx, onClick }: { tx: FinTx; onClick: () => void }) {
  const meta = tx.category ? CATEGORY_META[tx.category] : null
  return (
    <button type="button" onClick={onClick} className="flex min-h-[62px] w-full items-center gap-3 rounded-2xl px-2 text-left active:bg-surface-2">
      <CategoryBadge category={tx.category} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-medium">{txTitle(tx)}</span>
        <span className="block truncate text-[13px] text-muted">
          {meta ? meta.label : <span className="font-semibold text-warning">Needs a category</span>}
          {tx.note ? ` · ${tx.note}` : tx.payee && tx.purpose ? ` · ${tx.purpose}` : ''}
        </span>
      </span>
      <span className={`shrink-0 text-[16px] font-semibold tabular ${tx.amount > 0 ? 'text-success' : ''}`}>{formatEUR(tx.amount, { sign: true })}</span>
    </button>
  )
}

export function timeAgo(at: number, now = Date.now()): string {
  const min = Math.round((now - at) / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return d === 1 ? 'yesterday' : `${d} days ago`
}
