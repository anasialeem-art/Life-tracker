import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { calendarKey } from '../../lib/day'
import { db, type FinTx } from '../../lib/db'
import {
  CATEGORY_META, PAID_CATEGORIES, SPEND_CATEGORIES, detectSubscriptions, formatEUR, limitState, monthLabel, monthOf,
  spendByCategory, type LimitState, type SpendCategory,
} from '../../lib/finance'
import { isNativeApp } from '../../lib/native'
import { navigate } from '../../lib/router'
import { useSettings } from '../../lib/settings'
import { AlertIcon, CheckIcon, ChevronRight, SyncIcon, UploadIcon, WalletIcon } from '../../components/Icons'
import { Button, Card, EmptyState, Page, SectionLabel } from '../../components/ui'
import type { OpenActivity } from './Finance'
import { CategoryBadge, TxRow, timeAgo } from './parts'
import { TxSheet } from './TxSheet'

const STATE_COLOR: Record<LimitState, string | null> = {
  none: null, ok: null, near: 'var(--warning)', over: 'var(--danger)', paid: 'var(--success)',
}

export function Overview({ txs, syncing, onSync, onImport, onOpenActivity, onOpenSubs }: {
  txs: FinTx[] | undefined
  syncing: boolean
  onSync: () => void
  onImport: () => void
  onOpenActivity: OpenActivity
  onOpenSubs: () => void
}) {
  const settings = useSettings()
  const [openTx, setOpenTx] = useState<string | null>(null)
  const balance = useLiveQuery(() => db.finBalances.orderBy('day').last())
  const ignored = useLiveQuery(() => db.finIgnoredSubs.toArray()) ?? []
  const today = calendarKey(new Date())
  const month = monthOf(today)
  const native = isNativeApp()
  const lastSync = settings?.finLastSyncAt ?? null
  const connected = lastSync !== null

  const thisMonth = (txs ?? []).filter((t) => t.month === month)
  const spent = spendByCategory(thisMonth)
  const totalSpent = SPEND_CATEGORIES.reduce((n, c) => n + Math.max(0, spent[c]), 0)
  const moneyIn = thisMonth.filter((t) => t.category === 'income').reduce((n, t) => n + t.amount, 0)
  const uncategorised = (txs ?? []).filter((t) => t.category === null)
  const recent = [...(txs ?? [])].sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)).slice(0, 4)

  // Without a set limit, a subscription bar fills towards what the detected subscriptions cost per month.
  const subs = txs ? detectSubscriptions(txs, today, new Set(ignored.map((i) => i.key))) : []
  const expected = (c: SpendCategory) => subs.filter((s) => s.category === c).reduce((n, s) => n + s.perMonth, 0)
  const limitOf = (c: SpendCategory) => settings?.finLimits?.[c] || (PAID_CATEGORIES.includes(c) ? expected(c) : 0)

  return (
    <Page>
      <div className="animate-rise-in relative overflow-hidden rounded-[26px] p-5 text-white shadow-[0_12px_32px_-14px_var(--c-finance)]"
        style={{ background: 'linear-gradient(135deg, #075985 0%, #0b8fc9 55%, #22c7e6 100%)' }}>
        <div className="pointer-events-none absolute -top-14 -right-12 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-white/[0.06]" />
        <p className="relative text-[13px] font-semibold uppercase tracking-[0.08em] text-white/75">Balance · Girokonto</p>
        <p className="relative mt-1.5 text-[42px] leading-none font-bold tracking-tight tabular">
          {balance ? formatEUR(balance.amount) : '€ —'}
        </p>
        <p className="relative mt-1.5 text-[14px] text-white/80">
          {balance ? `Commerzbank · as of ${new Date(`${balance.day}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : txs?.length ? 'Balance arrives with a bank sync' : 'Not synced yet'}
        </p>
        <p className="relative mt-4 text-[13px] text-white/80">
          {lastSync ? <>Last sync <span className="font-semibold text-white">{timeAgo(lastSync)}</span></> : native ? 'Sync with Commerzbank or import a statement' : 'Import a statement · sync is in the Android app'}
        </p>
        <div className="relative mt-2.5 flex gap-2">
          <button type="button" onClick={onImport}
            className="pressable flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white/20 px-4 text-[15px] font-semibold text-white backdrop-blur-sm">
            <UploadIcon size={18} strokeWidth={2.2} /> Import
          </button>
          {native && (
            <button type="button" onClick={onSync} disabled={syncing}
              className="pressable flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 text-[15px] font-semibold text-[#075985] disabled:opacity-70">
              <SyncIcon size={18} strokeWidth={2.2} className={syncing ? 'animate-spin' : ''} /> {syncing ? 'Syncing' : 'Sync'}
            </button>
          )}
        </div>
      </div>

      {!native && !txs?.length && (
        <Card>
          <EmptyState icon={<UploadIcon size={26} />} title="Import your transactions"
            action={<Button small onClick={onImport}><UploadIcon size={18} /> Import statement</Button>}>
            In Commerzbank online banking open Umsätze → Export → CSV, then import the file here. Automatic sync works in the Android app.
          </EmptyState>
        </Card>
      )}
      {native && !connected && (
        <Card>
          <EmptyState icon={<WalletIcon size={26} />} title="Connect Commerzbank"
            action={<Button small onClick={() => navigate('/more/finance/settings')}>Set up</Button>}>
            Add your product registration number, IBAN and login once. Read-only: the app can never send money. You can also import a CSV statement any time.
          </EmptyState>
        </Card>
      )}

      {uncategorised.length > 0 && (
        <button type="button" onClick={() => onOpenActivity({ category: 'none' })}
          className="pressable flex min-h-[56px] items-center gap-3 rounded-[22px] bg-warning-soft px-4 text-left">
          <AlertIcon size={22} className="shrink-0 text-warning" />
          <span className="flex-1 text-[15px] font-semibold text-warning">
            {uncategorised.length} transaction{uncategorised.length === 1 ? ' needs' : 's need'} a category
          </span>
          <ChevronRight size={18} className="text-warning" />
        </button>
      )}

      <SectionLabel action={<span className="text-[14px] font-semibold tabular">{formatEUR(totalSpent)} spent</span>}>
        {monthLabel(month)}
      </SectionLabel>
      <Card className="flex flex-col gap-4">
        {SPEND_CATEGORIES.map((c) => {
          const value = Math.max(0, spent[c])
          const limit = limitOf(c)
          const state = limitState(c, value, limit)
          const meta = CATEGORY_META[c]
          const color = STATE_COLOR[state] ?? meta.color
          const paidCat = PAID_CATEGORIES.includes(c)
          return (
            <button key={c} type="button" onClick={() => onOpenActivity({ month, category: c })} className="flex flex-col gap-2 text-left">
              <div className="flex items-center gap-3">
                <CategoryBadge category={c} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold">{meta.label}</span>
                  <span className="block text-[13px] text-muted">
                    {state === 'paid' ? <span className="inline-flex items-center gap-1 font-semibold text-success"><CheckIcon size={14} strokeWidth={3} /> Paid this month</span>
                      : state === 'over' ? <span className="font-semibold text-danger">{formatEUR(value - limit)} over{paidCat ? ' expected' : ' limit'}</span>
                      : state === 'near' ? <span className="font-semibold text-warning">{formatEUR(limit - value)} left</span>
                      : limit > 0 ? (paidCat ? `${formatEUR(limit - value)} still to pay` : `${formatEUR(limit - value)} left`)
                      : meta.hint ?? 'No limit set'}
                  </span>
                </span>
                <span className="text-right tabular">
                  <span className="block text-[16px] font-semibold">{formatEUR(value)}</span>
                  {limit > 0 && <span className="block text-[12px] text-muted">of {formatEUR(limit, { whole: limit % 100 === 0 })}</span>}
                </span>
              </div>
              {limit > 0 && (
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full transition-[width,background-color] duration-700 ease-[cubic-bezier(.2,.9,.25,1)]"
                    style={{ width: `${Math.min(100, (value / limit) * 100)}%`, background: color }} />
                </div>
              )}
            </button>
          )
        })}
        {SPEND_CATEGORIES.every((c) => !limitOf(c)) && (
          <button type="button" onClick={() => navigate('/more/finance/settings')} className="text-left text-[14px] font-semibold text-accent">
            Set monthly limits to see progress bars →
          </button>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card onClick={() => onOpenActivity({ month, category: 'income' })}>
          <p className="text-[13px] font-semibold text-muted">Money in</p>
          <p className="mt-1 text-[20px] font-bold text-success tabular">{formatEUR(moneyIn)}</p>
        </Card>
        <Card onClick={onOpenSubs}>
          <p className="text-[13px] font-semibold text-muted">Recurring</p>
          <p className="mt-1 text-[20px] font-bold tabular">{formatEUR(subs.reduce((n, s) => n + s.perMonth, 0))}<span className="text-[13px] font-semibold text-muted"> /mo</span></p>
        </Card>
      </div>

      {recent.length > 0 && (
        <>
          <SectionLabel action={<button type="button" onClick={() => onOpenActivity({})} className="text-[14px] font-semibold text-accent">See all</button>}>
            Recent
          </SectionLabel>
          <div className="rounded-[22px] bg-surface px-2 py-1 shadow-card">
            {recent.map((t) => <TxRow key={t.id} tx={t} onClick={() => setOpenTx(t.id)} />)}
          </div>
        </>
      )}
      <TxSheet id={openTx} onClose={() => setOpenTx(null)} />
    </Page>
  )
}
