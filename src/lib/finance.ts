import { addDays, daysBetween, parseKey, type DayKey } from './day'
import { db, getMeta, setMeta, uid, type FinBalance, type FinCategory, type FinRule, type FinTx } from './db'

// Pure Finance logic: categories, rules, dedupe keys, monthly totals, subscriptions, balance history.
// Amounts are always integer cents; negative = money going out.

export const SPEND_CATEGORIES = ['groceries', 'food', 'subscriptions', 'gym', 'other'] as const
export type SpendCategory = (typeof SPEND_CATEGORIES)[number]
export const ALL_CATEGORIES: FinCategory[] = [...SPEND_CATEGORIES, 'income', 'transfer']

export const CATEGORY_META: Record<FinCategory, { label: string; icon: string; color: string; hint?: string }> = {
  groceries: { label: 'Groceries', icon: '🛒', color: '#22a957' },
  food: { label: 'Food', icon: '🍔', color: '#f08800', hint: 'Eating out & delivery' },
  subscriptions: { label: 'Subscriptions', icon: '🔁', color: '#5b57e0' },
  gym: { label: 'Gym', icon: '🏋️', color: '#f2295b' },
  other: { label: 'Other', icon: '📦', color: '#8e8e93' },
  income: { label: 'Income', icon: '💶', color: '#1fa855', hint: 'Salary and money in' },
  transfer: { label: 'Transfer', icon: '↔️', color: '#0b98d4', hint: 'Between your own accounts' },
}

/** Income and own-account transfers never count as spending. */
export const isSpendCategory = (c: FinCategory | null): c is SpendCategory => c !== null && c !== 'income' && c !== 'transfer'

/** For these a full bar means "paid this month" rather than "budget used up". */
export const PAID_CATEGORIES: SpendCategory[] = ['subscriptions', 'gym']

export function formatEUR(cents: number, opts: { sign?: boolean; whole?: boolean } = {}): string {
  const abs = Math.abs(cents) / 100
  const n = abs.toLocaleString('en-GB', { minimumFractionDigits: opts.whole ? 0 : 2, maximumFractionDigits: opts.whole ? 0 : 2 })
  const sign = cents < 0 ? '−' : opts.sign && cents > 0 ? '+' : ''
  return `${sign}€${n}`
}

/** Parses "12,50" / "12.50" / "12" into cents; null if not a valid non-negative amount. */
export function parseEUR(s: string): number | null {
  const cleaned = s.replace(/[\s€]/g, '').replace(',', '.')
  if (cleaned === '') return 0
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null
  return Math.round(parseFloat(cleaned) * 100)
}

export const monthOf = (day: DayKey) => day.slice(0, 7)

export function monthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  const d = parseKey(`${month}-01`)
  return style === 'long'
    ? d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : d.toLocaleDateString('en-GB', { month: 'short' })
}

/** The month before/after `month` (YYYY-MM). */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + by, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function lastDayOfMonth(month: string): DayKey {
  return addDays(`${shiftMonth(month, 1)}-01`, -1)
}

// ---- Dedupe -------------------------------------------------------------------

/** What a bank connector hands over for one booked transaction. */
export interface RawTx {
  day: DayKey
  amount: number
  payee: string
  payeeIban: string
  purpose: string
}

export const normText = (s: string) => s.replace(/\s+/g, ' ').trim()
export const normIban = (s: string) => s.replace(/\s+/g, '').toUpperCase()

/** Bank code (BLZ) from a German IBAN, which FinTS needs to address the right Commerzbank branch. */
export const blzFromIban = (iban: string) => {
  const i = normIban(iban)
  return /^DE\d{20}$/.test(i) ? i.slice(4, 12) : null
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Stable ids from date, amount, payee and purpose. Two genuinely identical
 * payments on the same day (two coffees) get a repeat counter, so they stay two
 * rows; a sync always fetches whole days, so the counter is reproducible.
 */
export async function txIds(rows: RawTx[]): Promise<string[]> {
  const seen = new Map<string, number>()
  const out: string[] = []
  for (const r of rows) {
    const base = `${r.day}|${r.amount}|${normText(r.payee)}|${normText(r.purpose)}`
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    out.push((await sha256Hex(`${base}|${n}`)).slice(0, 32))
  }
  return out
}

// ---- Categorisation -------------------------------------------------------------

export interface CategoryContext {
  rules: FinRule[]
  ownIbans: string[]
  /** Account holder name from the bank, for spotting transfers to your own other accounts. */
  holder: string | null
}

const nameTokens = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-zß]+/).filter((t) => t.length > 1)

/** True when every part of the holder's name appears in the payee ("ALEEM, ANAS" matches "Anas Aleem"). */
export function isOwnName(payee: string, holder: string | null): boolean {
  if (!holder) return false
  const want = nameTokens(holder)
  if (want.length === 0) return false
  const have = new Set(nameTokens(payee))
  return want.every((t) => have.has(t))
}

export function ruleMatches(rule: FinRule, tx: Pick<FinTx, 'payee' | 'purpose'>): boolean {
  const needle = rule.contains.trim().toLowerCase()
  if (!needle) return false
  const payee = tx.payee.toLowerCase()
  const purpose = tx.purpose.toLowerCase()
  if (rule.field === 'payee') return payee.includes(needle)
  if (rule.field === 'purpose') return purpose.includes(needle)
  return payee.includes(needle) || purpose.includes(needle)
}

export const sortRules = (rules: FinRule[]) => [...rules].sort((a, b) => a.order - b.order || a.createdAt - b.createdAt)

/** Rules first (your corrections win), then own-account transfers, then money in = income. */
export function autoCategory(tx: Pick<FinTx, 'payee' | 'purpose' | 'payeeIban' | 'amount'>, ctx: CategoryContext): Pick<FinTx, 'category' | 'categorySource'> {
  for (const r of sortRules(ctx.rules)) if (ruleMatches(r, tx)) return { category: r.category, categorySource: 'rule' }
  const iban = normIban(tx.payeeIban)
  if ((iban && ctx.ownIbans.some((o) => normIban(o) === iban)) || isOwnName(tx.payee, ctx.holder)) {
    return { category: 'transfer', categorySource: 'auto' }
  }
  if (tx.amount > 0) return { category: 'income', categorySource: 'auto' }
  return { category: null, categorySource: null }
}

/** Starter rules for common German shops; all editable and deletable. */
export const STARTER_RULES: [string, FinCategory][] = [
  ['REWE', 'groceries'], ['LIDL', 'groceries'], ['ALDI', 'groceries'], ['EDEKA', 'groceries'], ['NETTO', 'groceries'],
  ['PENNY', 'groceries'], ['KAUFLAND', 'groceries'], ['NORMA', 'groceries'], ['TEGUT', 'groceries'],
  ['LIEFERANDO', 'food'], ['WOLT', 'food'], ['UBER EATS', 'food'], ['MCDONALD', 'food'], ['BURGER KING', 'food'],
  ['DOMINOS', 'food'], ['KFC', 'food'],
  ['SPOTIFY', 'subscriptions'], ['NETFLIX', 'subscriptions'], ['DISNEY PLUS', 'subscriptions'], ['YOUTUBE', 'subscriptions'],
  ['MCFIT', 'gym'], ['FITX', 'gym'], ['JOHN REED', 'gym'], ['CLEVER FIT', 'gym'], ['FITNESS FIRST', 'gym'],
  ['URBAN SPORTS', 'gym'], ['EASYFIT', 'gym'],
]

/** Seeds the starter rules once per device, and never into a list that already has rules. */
export async function ensureStarterRules(): Promise<void> {
  if (await getMeta('finSeededRules')) return
  await db.transaction('rw', db.finRules, db.meta, async () => {
    await setMeta('finSeededRules', true)
    if ((await db.finRules.count()) > 0) return
    const now = Date.now()
    await db.finRules.bulkAdd(STARTER_RULES.map(([contains, category], i) => ({
      id: uid(), field: 'payee', contains, category, order: 1000 + i, createdAt: now,
    })))
  })
}

export async function loadCategoryContext(): Promise<CategoryContext> {
  const [rules, own, bank] = await Promise.all([
    db.finRules.toArray(),
    db.settings.get('finOwnIbans'),
    getMeta<{ holder?: string | null }>('finBank'),
  ])
  return { rules, ownIbans: (own?.value as string[] | undefined) ?? [], holder: bank?.holder ?? null }
}

/** Re-applies rules and detection to every transaction the user has not categorised by hand. */
export async function recategorizeAll(): Promise<number> {
  return db.transaction('rw', db.finTx, db.finRules, db.settings, db.meta, async () => {
    const ctx = await loadCategoryContext()
    const changed: FinTx[] = []
    await db.finTx.each((tx) => {
      if (tx.categorySource === 'manual') return
      const next = autoCategory(tx, ctx)
      if (next.category !== tx.category || next.categorySource !== tx.categorySource) changed.push({ ...tx, ...next })
    })
    if (changed.length) await db.finTx.bulkPut(changed)
    return changed.length
  })
}

/** A sensible rule for "apply to all similar": the payee name, or the purpose when there is no payee. */
export function suggestRule(tx: Pick<FinTx, 'payee' | 'purpose'>): Pick<FinRule, 'field' | 'contains'> {
  const payee = normText(tx.payee)
  if (payee) return { field: 'payee', contains: payee }
  return { field: 'purpose', contains: normText(tx.purpose).split(' ').slice(0, 3).join(' ') }
}

export async function setTxCategory(id: string, category: FinCategory | null): Promise<void> {
  await db.finTx.update(id, { category, categorySource: category ? 'manual' : null })
}

/** Adds a rule at the top of the list and re-applies everything. */
export async function addRule(rule: Pick<FinRule, 'field' | 'contains' | 'category'>): Promise<void> {
  const first = await db.finRules.orderBy('order').first()
  await db.finRules.add({ ...rule, contains: rule.contains.trim(), id: uid(), order: (first?.order ?? 1000) - 1, createdAt: Date.now() })
  await recategorizeAll()
}

// ---- Totals -----------------------------------------------------------------------

/** Net spending per category (refunds in a category reduce it). */
export function spendByCategory(txs: FinTx[]): Record<SpendCategory, number> {
  const out = Object.fromEntries(SPEND_CATEGORIES.map((c) => [c, 0])) as Record<SpendCategory, number>
  for (const t of txs) if (isSpendCategory(t.category)) out[t.category] -= t.amount
  return out
}

export type LimitState = 'none' | 'ok' | 'near' | 'over' | 'paid'

/** Bar state: budgets warn from 80% and turn red over 100%; "paid" categories are done when full. */
export function limitState(category: SpendCategory, spent: number, limit: number): LimitState {
  if (limit <= 0) return 'none'
  const ratio = spent / limit
  if (PAID_CATEGORIES.includes(category)) {
    if (ratio > 1.05) return 'over'
    return ratio >= 0.98 ? 'paid' : 'ok'
  }
  if (ratio > 1) return 'over'
  return ratio >= 0.8 ? 'near' : 'ok'
}

/** Month-end balances worked backwards from the latest bank balance. */
export function balanceHistory(txs: FinTx[], latest: FinBalance | undefined, months: string[]): { month: string; amount: number }[] {
  if (!latest) return []
  const firstTx = txs.reduce<DayKey | null>((m, t) => (m === null || t.day < m ? t.day : m), null)
  const out: { month: string; amount: number }[] = []
  for (const month of months) {
    const end = lastDayOfMonth(month) < latest.day ? lastDayOfMonth(month) : latest.day
    // Before the first known transaction the balance is unknown.
    if (firstTx && end < addDays(firstTx, -1)) continue
    let amount = latest.amount
    for (const t of txs) if (t.day > end && t.day <= latest.day) amount -= t.amount
    out.push({ month, amount })
  }
  return out
}

// ---- Subscriptions ------------------------------------------------------------------

export type SubInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly'

const INTERVALS: { key: SubInterval; min: number; max: number; perMonth: number; minCount: number }[] = [
  { key: 'weekly', min: 5, max: 9, perMonth: 52 / 12, minCount: 4 },
  { key: 'monthly', min: 25, max: 36, perMonth: 1, minCount: 3 },
  { key: 'quarterly', min: 80, max: 100, perMonth: 1 / 3, minCount: 2 },
  { key: 'yearly', min: 345, max: 385, perMonth: 1 / 12, minCount: 2 },
]

export interface DetectedSub {
  key: string
  payee: string
  /** Latest charge, positive cents. */
  amount: number
  interval: SubInterval
  perMonth: number
  lastDay: DayKey
  count: number
  category: FinCategory | null
}

/** Payee without numbers and punctuation ("NETFLIX.COM 866-579" → "netflix com"). */
export function payeeKey(payee: string): string {
  return payee.toLowerCase().replace(/[^a-zäöüß]+/g, ' ').trim().split(' ').slice(0, 3).join(' ')
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/**
 * Recurring payments: same payee, similar amount (within 10% or €1), regular gaps.
 * Ones that stopped (no charge for 1.5 intervals) are left out, and so is supermarket
 * shopping, where a weekly shop of similar size would otherwise look like a subscription.
 */
export function detectSubscriptions(txs: FinTx[], today: DayKey, ignored: Set<string> = new Set()): DetectedSub[] {
  const groups = new Map<string, FinTx[]>()
  for (const t of txs) {
    if (t.amount >= 0 || t.category === 'transfer' || t.category === 'income' || t.category === 'groceries') continue
    const k = payeeKey(t.payee)
    if (!k) continue
    groups.set(k, [...(groups.get(k) ?? []), t])
  }
  const found: DetectedSub[] = []
  for (const [pk, list] of groups) {
    // Split one payee into amount clusters (PayPal pays many different things).
    const byAmount = [...list].sort((a, b) => a.amount - b.amount)
    const clusters: FinTx[][] = []
    for (const t of byAmount) {
      const c = clusters.at(-1)
      const ref = c ? -median(c.map((x) => x.amount)) : 0
      if (c && Math.abs(-t.amount - ref) <= Math.max(100, ref * 0.1)) c.push(t)
      else clusters.push([t])
    }
    for (const c of clusters) {
      const sorted = [...c].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
      if (sorted.length < 2) continue
      const gaps = sorted.slice(1).map((t, i) => daysBetween(sorted[i].day, t.day))
      const g = median(gaps)
      const iv = INTERVALS.find((x) => g >= x.min && g <= x.max)
      if (!iv || sorted.length < iv.minCount) continue
      const regular = gaps.filter((d) => d >= iv.min && d <= iv.max).length
      if (regular / gaps.length < 0.75) continue
      const last = sorted.at(-1)!
      if (daysBetween(last.day, today) > iv.max * 1.5) continue
      const key = `${pk}|${iv.key}|${Math.round(-median(c.map((x) => x.amount)) / 100)}`
      if (ignored.has(key)) continue
      found.push({
        key, payee: normText(last.payee), amount: -last.amount, interval: iv.key,
        perMonth: Math.round(-last.amount * iv.perMonth), lastDay: last.day, count: sorted.length, category: last.category,
      })
    }
  }
  return found.sort((a, b) => b.perMonth - a.perMonth)
}

export const INTERVAL_LABEL: Record<SubInterval, string> = { weekly: 'Weekly', monthly: 'Monthly', quarterly: 'Every 3 months', yearly: 'Yearly' }
