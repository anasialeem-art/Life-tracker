import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, uid, type Habit, type HabitFrequency } from '../../lib/db'
import { describeFrequency, habitShownOn, HABIT_ICONS, weekCount, weekOf } from '../../lib/habits'
import { useSelectedDay } from '../../lib/hooks'
import { useToday } from '../../lib/useToday'
import { DayNav, FutureNotice } from '../../components/DayNav'
import { ArchiveIcon, CheckIcon, HabitIcon, PlusIcon } from '../../components/Icons'
import { ConfirmSheet, Sheet, SheetAction } from '../../components/Sheet'
import { IconButton, TopBar } from '../../components/TopBar'
import { Button, Card, Check, EmptyState, Field, Page, Ring, Segmented, Stepper, TextInput } from '../../components/ui'

export function Habits() {
  const today = useToday()
  const [day, setDay] = useSelectedDay(today)
  const habits = useLiveQuery(() => db.habits.orderBy('order').toArray())
  const week = weekOf(day)
  const checks = useLiveQuery(() => db.habitChecks.where('day').between(week[0], week[6], true, true).toArray(), [week[0]]) ?? []
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const future = day > today

  const shown = (habits ?? []).filter((h) => habitShownOn(h, day))
  const isChecked = (h: Habit) => checks.some((c) => c.habitId === h.id && c.day === day)
  const done = shown.filter(isChecked).length

  const toggle = async (h: Habit) => {
    const id = `${h.id}|${day}`
    if (await db.habitChecks.get(id)) await db.habitChecks.delete(id)
    else await db.habitChecks.put({ id, habitId: h.id, day })
  }

  return (
    <>
      <TopBar title="Habits" backTo="/more" actions={
        <IconButton label="New habit" tinted onClick={() => setEditing('new')}><PlusIcon size={22} strokeWidth={2.4} /></IconButton>
      } />
      <Page>
        <DayNav day={day} today={today} onChange={setDay} />
        {future && <FutureNotice />}
        {habits && habits.filter((h) => !h.archived).length === 0 ? (
          <Card className="animate-rise-in">
            <EmptyState icon={<HabitIcon size={28} />} title="No habits yet"
              action={<Button small onClick={() => setEditing('new')}><PlusIcon size={18} /> Add habit</Button>}>
              Daily, on certain weekdays, or a few times a week. Just a checkbox, no pressure.
            </EmptyState>
          </Card>
        ) : (
          <div className="stagger flex flex-col gap-3" key={day}>
            {shown.length > 0 && (
              <Card className="flex items-center gap-4">
                <Ring value={done} max={shown.length} size={56} stroke={6}>
                  {done === shown.length ? <CheckIcon size={22} strokeWidth={3} className="text-accent" /> : <span className="text-[14px] font-bold tabular">{done}/{shown.length}</span>}
                </Ring>
                <div>
                  <p className="text-[17px] font-semibold">{done === shown.length ? 'All done' : `${done} of ${shown.length} done`}</p>
                  <p className="text-[14px] text-muted">{done === shown.length ? 'Nice work.' : `${shown.length - done} to go`}</p>
                </div>
              </Card>
            )}
            <div className="rounded-[22px] bg-surface px-4 py-1 shadow-card">
              {shown.length === 0 && <p className="py-6 text-center text-[15px] text-muted">No habits on this day.</p>}
              {shown.map((h) => {
                const checked = isChecked(h)
                const count = weekCount(h, checks, day)
                return (
                  <div key={h.id} className="flex min-h-[64px] items-center gap-3 border-b border-line py-2 last:border-0">
                    <button type="button" onClick={() => setEditing(h)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-[22px] transition-colors ${checked ? 'bg-accent-soft' : 'bg-surface-2'}`}>{h.icon}</span>
                      <span className="min-w-0">
                        <span className={`block truncate text-[16px] font-semibold ${checked ? 'text-muted' : ''}`}>{h.name}</span>
                        <span className="block text-[13px] text-muted">
                          {h.frequency.type === 'perweek' ? `${count} of ${h.frequency.times} this week` : describeFrequency(h)}
                        </span>
                      </span>
                    </button>
                    <Check checked={checked} disabled={future} onChange={() => toggle(h)} size={30} label={h.name} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Page>
      <HabitSheet open={editing !== null} habit={editing === 'new' ? null : editing} count={habits?.length ?? 0} onClose={() => setEditing(null)} />
    </>
  )
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function HabitSheet({ open, habit, count, onClose }: { open: boolean; habit: Habit | null; count: number; onClose: () => void }) {
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(HABIT_ICONS[0])
  const [freq, setFreq] = useState<HabitFrequency>({ type: 'daily' })
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(habit?.name ?? '')
    setIcon(habit?.icon ?? HABIT_ICONS[count % HABIT_ICONS.length])
    setFreq(habit?.frequency ?? { type: 'daily' })
  }, [open, habit, count])

  const valid = name.trim() && (freq.type !== 'weekdays' || freq.days.length > 0)
  const save = async () => {
    if (!valid) return
    if (habit) await db.habits.update(habit.id, { name: name.trim(), icon, frequency: freq })
    else await db.habits.add({ id: uid(), name: name.trim(), icon, frequency: freq, order: Date.now(), archived: false, createdAt: Date.now() })
    onClose()
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={habit ? 'Edit habit' : 'New habit'}
        action={<SheetAction onClick={save} disabled={!valid}>{habit ? 'Save' : 'Add'}</SheetAction>}>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-accent-soft text-[32px]">{icon}</span>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Read 10 pages" autoFocus={!habit} />
          </div>
          <Field label="Icon">
            <div className="grid grid-cols-7 gap-2">
              {HABIT_ICONS.map((i) => (
                <button key={i} type="button" onClick={() => setIcon(i)}
                  className={`pressable flex aspect-square items-center justify-center rounded-2xl text-[22px] ${i === icon ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2'}`}>{i}</button>
              ))}
            </div>
          </Field>
          <Field label="How often">
            <Segmented value={freq.type} onChange={(t) => setFreq(t === 'daily' ? { type: t } : t === 'weekdays' ? { type: t, days: [1, 3, 5] } : { type: t, times: 3 })}
              options={[{ value: 'daily', label: 'Daily' }, { value: 'weekdays', label: 'Weekdays' }, { value: 'perweek', label: 'Per week' }]} />
          </Field>
          {freq.type === 'weekdays' && (
            <div className="animate-fade-in flex justify-between">
              {WEEKDAYS.map((w, i) => {
                const on = freq.days.includes(i)
                return (
                  <button key={i} type="button" aria-pressed={on} onClick={() => setFreq({ type: 'weekdays', days: on ? freq.days.filter((d) => d !== i) : [...freq.days, i] })}
                    className={`pressable h-11 w-11 rounded-full text-[15px] font-semibold transition-colors ${on ? 'bg-accent text-white' : 'bg-surface-2 text-muted'}`}>{w}</button>
                )
              })}
            </div>
          )}
          {freq.type === 'perweek' && (
            <div className="animate-fade-in flex items-center justify-between">
              <span className="text-[16px]">Times per week</span>
              <Stepper value={freq.times} min={1} max={7} onChange={(times) => setFreq({ type: 'perweek', times })} />
            </div>
          )}
          {habit && (
            <button type="button" onClick={() => setConfirm(true)}
              className="pressable flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-danger-soft text-[16px] font-semibold text-danger">
              <ArchiveIcon size={20} /> Remove habit
            </button>
          )}
        </div>
      </Sheet>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title={`Remove ${habit?.name ?? ''}?`} message="It stops showing up. Past check-ins stay in your backup."
        confirmLabel="Remove" onConfirm={async () => { if (habit) await db.habits.update(habit.id, { archived: true }); onClose() }} />
    </>
  )
}
