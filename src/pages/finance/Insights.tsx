import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { calendarKey } from '../../lib/day'
import { db, type FinTx } from '../../lib/db'
import { CATEGORY_META, SPEND_CATEGORIES, balanceHistory, formatEUR, monthLabel, monthOf, shiftMonth, spendByCategory } from '../../lib/finance'
import { ChartIcon } from '../../components/Icons'
import { BarChart, LineChart } from '../../components/Charts'
import { Card, EmptyState, Page, Segmented } from '../../components/ui'
import { CategoryBadge } from './parts'

type Range = '3' | '6' | '12' | 'all'

function readRange(): Range {
  try {
    const r = localStorage.getItem('finance-range') as Range | null
    return r && ['3', '6', '12', 'all'].includes(r) ? r : '6'
  } catch {
    return '6'
  }
}

export function Insights({ txs }: { txs: FinTx[] | undefined }) {
  const [range, setRangeState] = useState<Range>(readRange)
  const balance = useLiveQuery(() => db.finBalances.orderBy('day').last())
  const setRange = (r: Range) => {
    setRangeState(r)
    try { localStorage.setItem('finance-range', r) } catch { /* per-device preference only */ }
  }

  const current = monthOf(calendarKey(new Date()))
  const first = (txs ?? []).reduce<string>((m, t) => (t.month < m ? t.month : m), current)
  const count = range === 'all' ? monthsBetween(first, current) + 1 : Number(range)
  const months = Array.from({ length: count }, (_, i) => shiftMonth(current, i - count + 1))

  const byMonth = new Map<string, FinTx[]>()
  for (const t of txs ?? []) byMonth.set(t.month, [...(byMonth.get(t.month) ?? []), t])
  const spend = months.map((m) => spendByCategory(byMonth.get(m) ?? []))
  // Thin out labels when many months are shown so they stay readable.
  const every = Math.ceil(months.length / 12)
  const label = (m: string, i: number) => (i % every === 0 || i === months.length - 1 ? monthLabel(m, 'short') : '')
  const balances = balanceHistory(txs ?? [], balance, months)
  const whole = (v: number) => formatEUR(Math.round(v), { whole: true })

  if (txs && txs.length === 0) {
    return (
      <Page>
        <Card><EmptyState icon={<ChartIcon size={26} />} title="No data yet">Charts appear after your first sync.</EmptyState></Card>
      </Page>
    )
  }

  return (
    <Page>
      <Segmented value={range} onChange={setRange} size="sm" options={[
        { value: '3', label: '3 months' }, { value: '6', label: '6 months' }, { value: '12', label: '12 months' }, { value: 'all', label: 'All' },
      ]} />

      <Card>
        <div className="flex items-baseline justify-between">
          <p className="text-[16px] font-semibold">Balance</p>
          {balance && <p className="text-[15px] font-semibold tabular">{formatEUR(balance.amount)}</p>}
        </div>
        <p className="mb-2 text-[13px] text-muted">At the end of each month</p>
        {balances.length > 0
          ? <LineChart points={balances.map((b, i) => ({ x: i, y: b.amount, label: monthLabel(b.month, 'short') }))} format={whole} />
          : <p className="py-6 text-center text-[14px] text-muted">Sync once to see your balance over time.</p>}
      </Card>

      <Card>
        <CategoryChart title="All spending" icon={null} color="var(--accent)" values={spend.map((s) => SPEND_CATEGORIES.reduce((n, c) => n + Math.max(0, s[c]), 0))}
          months={months} label={label} />
      </Card>

      {SPEND_CATEGORIES.map((c) => (
        <Card key={c}>
          <CategoryChart title={CATEGORY_META[c].label} icon={<CategoryBadge category={c} size={32} />} color={CATEGORY_META[c].color}
            values={spend.map((s) => Math.max(0, s[c]))} months={months} label={label} />
        </Card>
      ))}
    </Page>
  )
}

function CategoryChart({ title, icon, color, values, months, label }: {
  title: string
  icon: React.ReactNode
  color: string
  values: number[]
  months: string[]
  label: (m: string, i: number) => string
}) {
  // The current month is still running, so the average uses finished months only.
  const done = values.slice(0, -1)
  const avg = done.length ? done.reduce((n, v) => n + v, 0) / done.length : values[0] ?? 0
  return (
    <>
      <div className="mb-3 flex items-center gap-3">
        {icon}
        <p className="flex-1 text-[16px] font-semibold">{title}</p>
        <p className="text-right text-[13px] text-muted">
          <span className="block font-semibold text-text tabular">{formatEUR(Math.round(avg), { whole: true })}</span>avg / month
        </p>
      </div>
      <BarChart bars={values.map((v, i) => ({ label: label(months[i], i), value: v / 100 }))} color={color} height={120}
        format={(v) => formatEUR(Math.round(v * 100), { whole: true })} />
    </>
  )
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}
