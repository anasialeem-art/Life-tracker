import { addDays, type DayKey } from './day'
import { db, setMeta, type FinTx } from './db'
import { autoCategory, loadCategoryContext, monthOf, normIban, normText, txIds, type RawTx } from './finance'

// Bank sync orchestration, independent of FinTS so it can be tested with a fake bank.
//
// Safety rule: nothing is written until the bank has answered completely and every
// row has been checked. The write itself is one IndexedDB transaction that only adds
// rows (plus the balance and the sync time), so a failure at any point leaves the
// existing data exactly as it was.

export type BankErrorKind =
  | 'pin' // wrong PIN or login number
  | 'locked' // access blocked by the bank
  | 'tan-timeout'
  | 'tan-cancelled'
  | 'tan-rejected'
  | 'unreachable' // no connection or the bank server did not answer
  | 'product' // product registration number missing or not accepted
  | 'setup' // missing details in Finance settings
  | 'account' // the Girokonto was not found in the bank's account list
  | 'bank' // any other bank error; the message carries the bank's own text

export class BankError extends Error {
  constructor(public kind: BankErrorKind, message: string, public detail = '') {
    super(message)
    this.name = 'BankError'
  }
}

export interface BankFetchResult {
  transactions: RawTx[]
  /** Booked balance in cents and the day it applies to. */
  balance: { amount: number; day: DayKey } | null
  /** Account holder name as the bank spells it (for spotting own-account transfers). */
  holder: string | null
}

export interface BankConnector {
  /** Booked transactions from `from` (whole days, inclusive) or as far back as the bank allows. */
  fetch(from: DayKey | null): Promise<BankFetchResult>
}

/** Days re-fetched before the newest stored transaction, to catch late bookings; dedupe removes repeats. */
export const SYNC_OVERLAP_DAYS = 7

export async function syncStartDay(): Promise<DayKey | null> {
  const newest = await db.finTx.orderBy('day').last()
  return newest ? addDays(newest.day, -SYNC_OVERLAP_DAYS) : null
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Rejects a malformed bank answer as a whole instead of storing half of it. */
export function validateFetch(r: BankFetchResult): void {
  if (!r || !Array.isArray(r.transactions)) throw new BankError('bank', 'The bank sent an answer the app could not read. Nothing was changed.')
  for (const t of r.transactions) {
    if (!DAY_RE.test(t.day) || !Number.isInteger(t.amount) || typeof t.payee !== 'string' || typeof t.purpose !== 'string') {
      throw new BankError('bank', 'The bank sent a transaction the app could not read. Nothing was changed.', JSON.stringify(t).slice(0, 200))
    }
  }
  if (r.balance && (!Number.isInteger(r.balance.amount) || !DAY_RE.test(r.balance.day))) {
    throw new BankError('bank', 'The bank sent a balance the app could not read. Nothing was changed.')
  }
}

export interface SyncResult { added: number; fetched: number; balance: number | null; at: number }

export type TxSource = NonNullable<FinTx['source']>

const cleanRows = (rows: RawTx[]) => rows.map((t) => ({
  ...t, payee: normText(t.payee), purpose: normText(t.purpose), payeeIban: normIban(t.payeeIban ?? ''),
}))

/**
 * Which rows are new. Same source: the hash of date, amount, payee and purpose.
 * Across sources (a statement file vs. the bank sync describe the same booking with
 * different text): a stored row from the other source with the same day and amount
 * counts as this one, one for one, so two equal coffees stay two.
 * Must run inside a transaction that covers finTx.
 */
async function planRows(rows: RawTx[], ids: string[], source: TxSource) {
  const stored = await db.finTx.bulkGet(ids)
  const days = [...new Set(rows.map((r) => r.day))]
  const other = new Map<string, number>()
  for (const t of await db.finTx.where('day').anyOf(days).toArray()) {
    if ((t.source ?? 'bank') === source) continue
    const k = `${t.day}|${t.amount}`
    other.set(k, (other.get(k) ?? 0) + 1)
  }
  const seen = new Set<string>()
  const fresh: number[] = []
  rows.forEach((r, i) => {
    const k = `${r.day}|${r.amount}`
    const hit = stored[i]
    if (hit || seen.has(ids[i])) {
      // An identical text from the other source also uses up that source's match.
      if (hit && (hit.source ?? 'bank') !== source && other.get(k)) other.set(k, other.get(k)! - 1)
      return
    }
    if (other.get(k)) {
      other.set(k, other.get(k)! - 1)
      return
    }
    seen.add(ids[i])
    fresh.push(i)
  })
  return fresh
}

/**
 * The one write path for bank data. Adds new rows (never overwrites, so your notes and
 * categories stay), plus the balance, in a single transaction: all or nothing.
 */
export async function commitRows(raw: RawTx[], source: TxSource, extra: { balance?: BankFetchResult['balance']; holder?: string | null; now?: number; dryRun?: boolean } = {}) {
  const now = extra.now ?? Date.now()
  const rows = cleanRows(raw)
  const ids = await txIds(rows)
  let added = 0
  await db.transaction('rw', [db.finTx, db.finBalances, db.finRules, db.settings, db.meta], async () => {
    const fresh = await planRows(rows, ids, source)
    added = fresh.length
    if (extra.dryRun) return
    if (extra.holder) {
      const bank = (await db.meta.get('finBank'))?.value as Record<string, unknown> | undefined
      await setMeta('finBank', { ...bank, holder: extra.holder })
    }
    const ctx = await loadCategoryContext()
    const add: FinTx[] = fresh.map((i) => ({
      ...rows[i], id: ids[i], month: monthOf(rows[i].day), note: '', syncedAt: now, source, ...autoCategory(rows[i], ctx),
    }))
    // bulkAdd, not bulkPut: an existing row (with your notes and categories) is never overwritten.
    if (add.length) await db.finTx.bulkAdd(add)
    if (extra.balance) {
      const cur = await db.finBalances.get(extra.balance.day)
      // A statement file never replaces a balance the bank reported for the same day.
      if (source === 'bank' || !cur) await db.finBalances.put({ day: extra.balance.day, amount: extra.balance.amount, at: now })
    }
    if (source === 'bank') await db.settings.put({ key: 'finLastSyncAt', value: now })
  })
  return { added, total: rows.length }
}

export async function runSync(connector: BankConnector, now = Date.now()): Promise<SyncResult> {
  const from = await syncStartDay()
  const result = await connector.fetch(from)
  validateFetch(result)
  const { added, total } = await commitRows(result.transactions, 'bank', { balance: result.balance, holder: result.holder, now })
  return { added, fetched: total, balance: result.balance?.amount ?? null, at: now }
}

/** Forget the bank's stored parameters (BPD/UPD, system id), e.g. after changing the login. Keeps the holder name. */
export async function resetBankState(): Promise<void> {
  const bank = (await db.meta.get('finBank'))?.value as { holder?: string | null } | undefined
  await setMeta('finBank', bank?.holder ? { holder: bank.holder } : undefined)
}
