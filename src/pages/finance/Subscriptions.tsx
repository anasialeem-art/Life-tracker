import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { calendarKey } from '../../lib/day'
import { db, type FinTx } from '../../lib/db'
import { INTERVAL_LABEL, detectSubscriptions, formatEUR, type DetectedSub } from '../../lib/finance'
import { RepeatIcon, XIcon } from '../../components/Icons'
import { ConfirmSheet } from '../../components/Sheet'
import { Button, Card, EmptyState, Page, SectionLabel } from '../../components/ui'
import { CategoryBadge } from './parts'

export function Subscriptions({ txs }: { txs: FinTx[] | undefined }) {
  const ignored = useLiveQuery(() => db.finIgnoredSubs.toArray())
  const [removing, setRemoving] = useState<DetectedSub | null>(null)
  const today = calendarKey(new Date())
  const subs = txs && ignored ? detectSubscriptions(txs, today, new Set(ignored.map((i) => i.key))) : []
  const total = subs.reduce((n, s) => n + s.perMonth, 0)

  return (
    <Page>
      <div className="animate-rise-in rounded-[26px] bg-surface p-5 shadow-card">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Recurring payments</p>
        <p className="mt-1 text-[36px] leading-none font-bold tracking-tight tabular">{formatEUR(total)}<span className="text-[17px] font-semibold text-muted"> / month</span></p>
        <p className="mt-1.5 text-[14px] text-muted">
          {subs.length} found · {formatEUR(total * 12, { whole: true })} a year
        </p>
      </div>

      {txs && subs.length === 0 && (
        <Card>
          <EmptyState icon={<RepeatIcon size={26} />} title="Nothing recurring found yet">
            Payments to the same payee with a similar amount at regular intervals show up here, usually after two or three months of transactions.
          </EmptyState>
        </Card>
      )}

      {subs.length > 0 && (
        <>
          <SectionLabel>Detected</SectionLabel>
          <div className="rounded-[22px] bg-surface px-2 py-1 shadow-card">
            {subs.map((s) => (
              <div key={s.key} className="flex min-h-[64px] items-center gap-3 px-2">
                <CategoryBadge category={s.category} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium">{s.payee}</span>
                  <span className="block truncate text-[13px] text-muted">
                    {INTERVAL_LABEL[s.interval]} · last {new Date(`${s.lastDay}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                </span>
                <span className="text-right tabular">
                  <span className="block text-[16px] font-semibold">{formatEUR(s.amount)}</span>
                  {s.interval !== 'monthly' && <span className="block text-[12px] text-muted">{formatEUR(s.perMonth)} / mo</span>}
                </span>
                <button type="button" aria-label={`Remove ${s.payee}`} onClick={() => setRemoving(s)}
                  className="pressable -mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-faint active:bg-surface-2">
                  <XIcon size={18} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {!!ignored?.length && (
        <Button variant="plain" onClick={() => db.finIgnoredSubs.clear()}>
          Show {ignored.length} removed item{ignored.length === 1 ? '' : 's'} again
        </Button>
      )}

      <ConfirmSheet open={removing !== null} onClose={() => setRemoving(null)} title="Not a subscription?"
        message={removing ? `${removing.payee} (${formatEUR(removing.amount)}, ${INTERVAL_LABEL[removing.interval].toLowerCase()}) will be left out of this list. Its transactions stay as they are.` : ''}
        confirmLabel="Remove from list" onConfirm={() => { if (removing) db.finIgnoredSubs.put({ key: removing.key }) }} />
    </Page>
  )
}
