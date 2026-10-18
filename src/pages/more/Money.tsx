import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, uid, type Expense, type MoneyCategory } from '../../lib/db'
import { parseKey, type DayKey } from '../../lib/day'
import { useSetting } from '../../lib/settings'
import { dueLabel } from '../../lib/todo'
import { useToday } from '../../lib/useToday'
import { ArrowDownIcon, ArrowUpIcon, GearIcon, PlusIcon, TrashIcon, WalletIcon } from '../../components/Icons'
import { ConfirmSheet, Sheet, SheetAction } from '../../components/Sheet'
import { IconButton, TopBar } from '../../components/TopBar'
import { Button, Card, Chip, EmptyState, Field, Page, SectionLabel, TextInput, inputCls } from '../../components/ui'

const CATEGORY_COLORS = ['#0b98d4', '#f08800', '#22a957', '#f2295b', '#a24fd8', '#5b57e0', '#0ea598', '#ac8e68']
export const CATEGORY_ICONS = ['🛒', '🍔', '🚆', '🛍️', '🧾', '📦', '🏠', '🎁', '💊', '🎮', '✈️', '☕️', '📚', '👕', '⛽️', '🕌']

export function formatMoney(cents: number, currency: string): string {
  const n = (cents / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency.length > 1 ? `${n} ${currency}` : `${currency}${n}`
}

function parseAmount(s: string): number | null {
  const cleaned = s.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null
  const cents = Math.round(parseFloat(cleaned) * 100)
  return cents > 0 ? cents : null
}

const monthKey = (day: DayKey) => day.slice(0, 7)
const monthLabel = (mk: string) => parseKey(`${mk}-01`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

export function Money() {
  const today = useToday()
  const currency = useSetting('currency')
  const expenses = useLiveQuery(() => db.expenses.orderBy('day').reverse().toArray())
  const categories = useLiveQuery(() => db.moneyCategories.orderBy('order').toArray()) ?? []
  const [editing, setEditing] = useState<Expense | 'new' | null>(null)
  const [manage, setManage] = useState(false)
  const [months, setMonths] = useState(6)

  const catById = new Map(categories.map((c, i) => [c.id, { ...c, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }]))
  const groups = new Map<string, Expense[]>()
  for (const e of expenses ?? []) groups.set(monthKey(e.day), [...(groups.get(monthKey(e.day)) ?? []), e])
  const thisMonth = monthKey(today)
  const current = groups.get(thisMonth) ?? []
  const total = current.reduce((n, e) => n + e.amount, 0)
  const byCat = [...current.reduce((m, e) => m.set(e.categoryId, (m.get(e.categoryId) ?? 0) + e.amount), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1])
  const monthKeys = [...groups.keys()].sort().reverse()

  return (
    <>
      <TopBar title="Money" backTo="/more" actions={<>
        <IconButton label="Categories" onClick={() => setManage(true)}><GearIcon size={21} /></IconButton>
        <IconButton label="Add expense" tinted onClick={() => setEditing('new')}><PlusIcon size={22} strokeWidth={2.4} /></IconButton>
      </>} />
      <Page>
        <div className="animate-rise-in relative overflow-hidden rounded-[26px] p-5 text-white shadow-[0_12px_32px_-14px_var(--c-money)]"
          style={{ background: 'linear-gradient(135deg, #0369a1 0%, #0b98d4 55%, #22d3ee 100%)' }}>
          <div className="pointer-events-none absolute -top-12 -right-10 h-44 w-44 rounded-full bg-white/10" />
          <p className="relative text-[13px] font-semibold uppercase tracking-[0.08em] text-white/75">{monthLabel(thisMonth)}</p>
          <p className="relative mt-1 text-[38px] leading-none font-bold tracking-tight tabular">{formatMoney(total, currency)}</p>
          <p className="relative mt-1 text-[14px] text-white/80">{current.length} expense{current.length === 1 ? '' : 's'} this month</p>
          {byCat.length > 0 && (
            <>
              <div className="relative mt-4 flex h-2.5 overflow-hidden rounded-full bg-white/20">
                {byCat.map(([id, v], i) => <div key={id} style={{ width: `${(v / total) * 100}%`, background: `rgb(255 255 255 / ${1 - i * 0.18})` }} />)}
              </div>
              <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {byCat.slice(0, 4).map(([id, v]) => (
                  <span key={id} className="text-[13px] font-medium text-white/90">{catById.get(id)?.icon} {catById.get(id)?.name ?? 'Other'} · {Math.round((v / total) * 100)}%</span>
                ))}
              </div>
            </>
          )}
        </div>

        {expenses && expenses.length === 0 && (
          <Card>
            <EmptyState icon={<WalletIcon size={28} />} title="No expenses yet"
              action={<Button small onClick={() => setEditing('new')}><PlusIcon size={18} /> Add expense</Button>}>
              Track what you spend by category. Totals add up per month.
            </EmptyState>
          </Card>
        )}

        {monthKeys.slice(0, months).map((mk) => {
          const items = groups.get(mk)!
          return (
            <div key={mk} className="flex flex-col gap-2">
              <SectionLabel action={<span className="text-[14px] font-semibold tabular">{formatMoney(items.reduce((n, e) => n + e.amount, 0), currency)}</span>}>
                {mk === thisMonth ? 'This month' : monthLabel(mk)}
              </SectionLabel>
              <div className="rounded-[22px] bg-surface px-2 py-1 shadow-card">
                {items.map((e) => {
                  const c = catById.get(e.categoryId)
                  return (
                    <button key={e.id} type="button" onClick={() => setEditing(e)}
                      className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-2 text-left active:bg-surface-2">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-[19px]"
                        style={{ background: `color-mix(in srgb, ${c?.color ?? '#888'} 16%, transparent)` }}>{c?.icon ?? '📦'}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-medium">{e.description || c?.name || 'Expense'}</span>
                        <span className="block text-[13px] text-muted">{c?.name ?? 'Other'} · {dueLabel(e.day, today)}</span>
                      </span>
                      <span className="text-[16px] font-semibold tabular">{formatMoney(e.amount, currency)}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
        {monthKeys.length > months && (
          <Button variant="secondary" onClick={() => setMonths(months + 6)}>Show older months</Button>
        )}
      </Page>
      <ExpenseSheet open={editing !== null} expense={editing === 'new' ? null : editing} categories={categories} today={today} currency={currency}
        onClose={() => setEditing(null)} />
      <CategoriesSheet open={manage} onClose={() => setManage(false)} />
    </>
  )
}

function ExpenseSheet({ open, expense, categories, today, currency, onClose }: {
  open: boolean
  expense: Expense | null
  categories: MoneyCategory[]
  today: DayKey
  currency: string
  onClose: () => void
}) {
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [day, setDay] = useState(today)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    setAmount(expense ? (expense.amount / 100).toFixed(2).replace('.', ',') : '')
    setCategoryId(expense?.categoryId ?? categories[0]?.id ?? '')
    setDescription(expense?.description ?? '')
    setDay(expense?.day ?? today)
  }, [open, expense, categories, today])

  const cents = parseAmount(amount)
  const valid = cents !== null && !!categoryId

  const save = async () => {
    if (!valid) return
    const fields = { amount: cents!, categoryId, description: description.trim(), day }
    if (expense) await db.expenses.update(expense.id, fields)
    else await db.expenses.add({ ...fields, id: uid(), createdAt: Date.now() })
    onClose()
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={expense ? 'Edit expense' : 'New expense'}
        action={<SheetAction onClick={save} disabled={!valid}>{expense ? 'Save' : 'Add'}</SheetAction>}>
        <div className="flex flex-col gap-5">
          <div className="flex items-baseline justify-center gap-1 py-2">
            <span className="text-[30px] font-semibold text-muted">{currency}</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="0,00" autoFocus={!expense}
              aria-label="Amount" className="w-48 bg-transparent text-center text-[48px] font-bold tracking-tight outline-none tabular placeholder:text-faint" />
          </div>
          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <Chip key={c.id} active={c.id === categoryId} onClick={() => setCategoryId(c.id)}><span>{c.icon}</span>{c.name}</Chip>
              ))}
            </div>
          </Field>
          <Field label="Description">
            <TextInput value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Weekly shop" />
          </Field>
          <Field label="Date">
            <input type="date" className={inputCls} value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </Field>
          {expense && (
            <button type="button" onClick={() => setConfirm(true)}
              className="pressable flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-danger-soft text-[16px] font-semibold text-danger">
              <TrashIcon size={20} /> Delete expense
            </button>
          )}
        </div>
      </Sheet>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title="Delete this expense?"
        message={expense ? `${formatMoney(expense.amount, currency)} · ${expense.description || 'no description'}` : ''}
        confirmLabel="Delete" onConfirm={async () => { if (expense) await db.expenses.delete(expense.id); onClose() }} />
    </>
  )
}

/** Add, rename, re-icon and reorder money categories. */
export function CategoriesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const categories = useLiveQuery(() => db.moneyCategories.orderBy('order').toArray()) ?? []
  const [editing, setEditing] = useState<MoneyCategory | 'new' | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(CATEGORY_ICONS[0])

  const startEdit = (c: MoneyCategory | 'new') => {
    setEditing(c)
    setName(c === 'new' ? '' : c.name)
    setIcon(c === 'new' ? CATEGORY_ICONS[categories.length % CATEGORY_ICONS.length] : c.icon)
  }
  const save = async () => {
    if (!name.trim()) return
    if (editing === 'new') await db.moneyCategories.add({ id: uid(), name: name.trim(), icon, order: Date.now() })
    else if (editing) await db.moneyCategories.update(editing.id, { name: name.trim(), icon })
    setEditing(null)
  }
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= categories.length) return
    await db.transaction('rw', db.moneyCategories, async () => {
      await db.moneyCategories.update(categories[i].id, { order: categories[j].order })
      await db.moneyCategories.update(categories[j].id, { order: categories[i].order })
    })
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Categories">
        <div className="flex flex-col gap-3">
          <div className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface-2/70">
            {categories.map((c, i) => (
              <div key={c.id} className="flex min-h-[54px] items-center gap-1 pr-1 pl-3">
                <button type="button" onClick={() => startEdit(c)} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left">
                  <span className="text-[20px]">{c.icon}</span><span className="truncate text-[16px] font-medium">{c.name}</span>
                </button>
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="pressable flex h-10 w-10 items-center justify-center text-muted disabled:opacity-25"><ArrowUpIcon size={18} /></button>
                <button type="button" aria-label="Move down" disabled={i === categories.length - 1} onClick={() => move(i, 1)} className="pressable flex h-10 w-10 items-center justify-center text-muted disabled:opacity-25"><ArrowDownIcon size={18} /></button>
              </div>
            ))}
          </div>
          <Button variant="tinted" onClick={() => startEdit('new')}><PlusIcon size={20} /> New category</Button>
        </div>
      </Sheet>
      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New category' : 'Edit category'}
        action={<SheetAction onClick={save} disabled={!name.trim()}>Save</SheetAction>}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-accent-soft text-[28px]">{icon}</span>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoFocus />
          </div>
          <div className="grid grid-cols-8 gap-2">
            {CATEGORY_ICONS.map((i) => (
              <button key={i} type="button" onClick={() => setIcon(i)}
                className={`pressable flex aspect-square items-center justify-center rounded-xl text-[20px] ${i === icon ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2'}`}>{i}</button>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  )
}
