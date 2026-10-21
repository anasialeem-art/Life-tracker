import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, uid, type ImportantDate } from '../../lib/db'
import { calendarKey, parseKey } from '../../lib/day'
import { daysUntil, nextOccurrence, yearsAt } from '../../lib/dates'
import { useToday } from '../../lib/useToday'
import { CakeIcon, PlusIcon, TrashIcon } from '../../components/Icons'
import { ConfirmSheet, Sheet, SheetAction } from '../../components/Sheet'
import { IconButton, TopBar } from '../../components/TopBar'
import { Button, Card, EmptyState, Field, Page, Segmented, TextInput, Toggle, inputCls } from '../../components/ui'

/** Highlighted this many days before. */
export const SOON_DAYS = 7

const KINDS: { value: ImportantDate['kind']; label: string; emoji: string }[] = [
  { value: 'birthday', label: 'Birthday', emoji: '🎂' },
  { value: 'anniversary', label: 'Anniversary', emoji: '💍' },
  { value: 'other', label: 'Other', emoji: '⭐️' },
]

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`

function yearsLabel(d: ImportantDate, today: string): string | null {
  const y = yearsAt(d, today)
  if (y === null || y < 0) return null
  if (d.kind === 'birthday') return `turns ${y}`
  if (d.kind === 'anniversary') return `${ordinal(y)} anniversary`
  return `${y} year${y === 1 ? '' : 's'}`
}

export function ImportantDates() {
  const today = useToday()
  const dates = useLiveQuery(() => db.importantDates.toArray())
  const [editing, setEditing] = useState<ImportantDate | 'new' | null>(null)
  const sorted = [...(dates ?? [])].sort((a, b) => daysUntil(a, today) - daysUntil(b, today) || a.title.localeCompare(b.title))

  return (
    <>
      <TopBar title="Important Dates" backTo="/more" actions={
        <IconButton label="Add date" tinted onClick={() => setEditing('new')}><PlusIcon size={22} strokeWidth={2.4} /></IconButton>
      } />
      <Page>
        {dates && dates.length === 0 ? (
          <Card className="animate-rise-in">
            <EmptyState icon={<CakeIcon size={28} />} title="No dates yet"
              action={<Button small onClick={() => setEditing('new')}><PlusIcon size={18} /> Add a date</Button>}>
              Birthdays, anniversaries and other yearly dates, sorted by what’s coming up next.
            </EmptyState>
          </Card>
        ) : (
          <div className="stagger flex flex-col gap-2">
            {sorted.map((d) => {
              const left = daysUntil(d, today)
              const soon = left <= SOON_DAYS
              const next = parseKey(nextOccurrence(d, today))
              const kind = KINDS.find((k) => k.value === d.kind)!
              const years = yearsLabel(d, today)
              return (
                <button key={d.id} type="button" onClick={() => setEditing(d)}
                  className={`pressable flex items-center gap-3 rounded-[22px] p-3.5 text-left shadow-card ${soon ? 'bg-accent-soft ring-1 ring-accent/30' : 'bg-surface'}`}>
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] text-[24px] ${soon ? 'bg-surface' : 'bg-surface-2'}`}>{kind.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">{d.title}</span>
                    <span className="block truncate text-[13px] text-muted">
                      {next.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })}{years ? ` · ${years}` : ''}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold tabular ${left === 0 ? 'bg-accent text-white' : soon ? 'bg-accent text-white' : 'bg-surface-2 text-muted'}`}>
                    {left === 0 ? 'Today 🎉' : left === 1 ? 'Tomorrow' : `${left} days`}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Page>
      <DateSheet open={editing !== null} item={editing === 'new' ? null : editing} today={today} onClose={() => setEditing(null)} />
    </>
  )
}

function DateSheet({ open, item, today, onClose }: { open: boolean; item: ImportantDate | null; today: string; onClose: () => void }) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<ImportantDate['kind']>('birthday')
  const [date, setDate] = useState(today)
  const [knowYear, setKnowYear] = useState(true)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(item?.title ?? '')
    setKind(item?.kind ?? 'birthday')
    setDate(item ? calendarKey(new Date(item.year ?? 2000, item.month - 1, item.day)) : today)
    setKnowYear(item ? item.year !== null : true)
  }, [open, item, today])

  const valid = title.trim() && date
  const save = async () => {
    if (!valid) return
    const d = parseKey(date)
    const fields = { title: title.trim(), kind, month: d.getMonth() + 1, day: d.getDate(), year: knowYear ? d.getFullYear() : null }
    if (item) await db.importantDates.update(item.id, fields)
    else await db.importantDates.add({ ...fields, id: uid() })
    onClose()
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={item ? 'Edit date' : 'New date'} action={<SheetAction onClick={save} disabled={!valid}>{item ? 'Save' : 'Add'}</SheetAction>}>
        <div className="flex flex-col gap-5">
          <Field label="Name"><TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mum’s birthday" autoFocus={!item} /></Field>
          <Field label="Type"><Segmented value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k.value, label: k.label }))} /></Field>
          <Field label="Date" hint="Repeats every year.">
            <input type="date" className={inputCls} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Field>
          <div className="flex min-h-[50px] items-center justify-between rounded-2xl bg-surface-2 pr-2 pl-4">
            <span className="text-[16px]">{kind === 'birthday' ? 'Birth year known' : 'Year known'}</span>
            <Toggle checked={knowYear} onChange={setKnowYear} label="Year known" />
          </div>
          {item && (
            <button type="button" onClick={() => setConfirm(true)} className="pressable flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-danger-soft text-[16px] font-semibold text-danger">
              <TrashIcon size={20} /> Delete
            </button>
          )}
        </div>
      </Sheet>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title={`Delete ${item?.title ?? ''}?`} message="This removes it from your important dates."
        confirmLabel="Delete" onConfirm={async () => { if (item) await db.importantDates.delete(item.id); onClose() }} />
    </>
  )
}
