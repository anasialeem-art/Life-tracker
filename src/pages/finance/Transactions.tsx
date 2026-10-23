import { useMemo, useState } from 'react'
import { calendarKey } from '../../lib/day'
import type { FinCategory, FinTx } from '../../lib/db'
import { ALL_CATEGORIES, CATEGORY_META, formatEUR, monthLabel, monthOf } from '../../lib/finance'
import { SearchIcon, WalletIcon, XIcon } from '../../components/Icons'
import { Button, Card, EmptyState, Page, SectionLabel } from '../../components/ui'
import { TxRow, dayHeading } from './parts'
import { TxSheet } from './TxSheet'

export interface TxFilter {
  month: string | null
  /** 'none' = needs a category. */
  category: FinCategory | 'all' | 'none'
  query: string
}

const PAGE = 150
const selectCls = 'h-11 min-w-0 flex-1 rounded-2xl bg-surface px-3 text-[15px] font-semibold shadow-card outline-none'

export function Transactions({ txs, filter, onFilter }: { txs: FinTx[] | undefined; filter: TxFilter; onFilter: (f: TxFilter) => void }) {
  const [openTx, setOpenTx] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const today = calendarKey(new Date())
  const months = useMemo(() => [...new Set((txs ?? []).map((t) => t.month))].sort().reverse(), [txs])

  const q = filter.query.trim().toLowerCase()
  const shown = useMemo(() => (txs ?? [])
    .filter((t) => (!filter.month || t.month === filter.month)
      && (filter.category === 'all' || (filter.category === 'none' ? t.category === null : t.category === filter.category))
      && (!q || `${t.payee} ${t.purpose} ${t.note}`.toLowerCase().includes(q) || formatEUR(t.amount).includes(q)))
    .sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : a.amount - b.amount)), [txs, filter.month, filter.category, q])

  const groups: [string, FinTx[]][] = []
  for (const t of shown.slice(0, limit)) {
    const last = groups.at(-1)
    if (last && last[0] === t.day) last[1].push(t)
    else groups.push([t.day, [t]])
  }
  const total = shown.reduce((n, t) => n + t.amount, 0)

  return (
    <Page>
      <div className="flex min-h-[48px] items-center gap-2 rounded-2xl bg-surface px-3 shadow-card focus-within:ring-2 focus-within:ring-accent/40">
        <SearchIcon size={20} className="shrink-0 text-muted" />
        <input value={filter.query} onChange={(e) => onFilter({ ...filter, query: e.target.value })} placeholder="Search payee, purpose, note" type="search"
          className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint" />
        {filter.query && (
          <button type="button" aria-label="Clear search" onClick={() => onFilter({ ...filter, query: '' })} className="text-muted"><XIcon size={18} /></button>
        )}
      </div>
      <div className="flex gap-2">
        <select aria-label="Month" value={filter.month ?? ''} onChange={(e) => onFilter({ ...filter, month: e.target.value || null })} className={selectCls}>
          <option value="">All months</option>
          {(months.includes(monthOf(today)) ? months : [monthOf(today), ...months]).map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <select aria-label="Category" value={filter.category} onChange={(e) => onFilter({ ...filter, category: e.target.value as TxFilter['category'] })} className={selectCls}>
          <option value="all">All categories</option>
          <option value="none">Needs a category</option>
          {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].icon} {CATEGORY_META[c].label}</option>)}
        </select>
      </div>

      {txs && shown.length === 0 && (
        <Card>
          <EmptyState icon={<WalletIcon size={26} />} title={txs.length ? 'Nothing matches' : 'No transactions yet'}>
            {txs.length ? 'Try another month, category or search.' : 'Sync with Commerzbank on the Overview to load your transactions.'}
          </EmptyState>
        </Card>
      )}
      {shown.length > 0 && (
        <p className="px-1 text-[13px] text-muted">
          {shown.length} transaction{shown.length === 1 ? '' : 's'} · <span className="font-semibold tabular">{formatEUR(total, { sign: true })}</span>
        </p>
      )}

      {groups.map(([day, items]) => (
        <div key={day} className="flex flex-col gap-1.5">
          <SectionLabel>{dayHeading(day, today)}</SectionLabel>
          <div className="rounded-[22px] bg-surface px-2 py-1 shadow-card">
            {items.map((t) => <TxRow key={t.id} tx={t} onClick={() => setOpenTx(t.id)} />)}
          </div>
        </div>
      ))}
      {shown.length > limit && <Button variant="secondary" onClick={() => setLimit(limit + PAGE)}>Show more</Button>}
      <TxSheet id={openTx} onClose={() => setOpenTx(null)} />
    </Page>
  )
}
