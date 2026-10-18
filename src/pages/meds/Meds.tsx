import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, uid, type Med, type MedLog } from '../../lib/db'
import { addDays, type DayKey } from '../../lib/day'
import { momentOn, useSelectedDay } from '../../lib/hooks'
import { describeCycleDay, describeSchedule, dosesDue, isVisibleOn, missedDays, nextDoseDay, scheduleOn } from '../../lib/meds'
import { dueLabel } from '../../lib/todo'
import { fmtTime } from '../../lib/prayer'
import { useToday } from '../../lib/useToday'
import { DayNav, FutureNotice } from '../../components/DayNav'
import { CalendarIcon, CheckIcon, DotsIcon, PillIcon, PlusIcon, XIcon } from '../../components/Icons'
import { MonthCalendar, monthRange } from '../../components/MonthCalendar'
import { Sheet } from '../../components/Sheet'
import { IconButton, TopBar } from '../../components/TopBar'
import { Button, Card, EmptyState, IconBadge, Page, Ring, SectionLabel } from '../../components/ui'
import { MedForm } from './MedForm'

function asNeededVisible(med: Med, day: DayKey) {
  const s = scheduleOn(med, day)
  return isVisibleOn(med, day) && (!s || day >= s.startDate) && (!s?.endDate || day <= s.endDate)
}

export function Meds() {
  const today = useToday()
  const [day, setDay] = useSelectedDay(today)
  const meds = useLiveQuery(() => db.meds.orderBy('order').toArray())
  const logs = useLiveQuery(() => db.medLogs.where('day').equals(day).toArray(), [day]) ?? []
  const [editing, setEditing] = useState<Med | 'new' | null>(null)
  const [overview, setOverview] = useState(false)

  const future = day > today
  const ended = day < today
  const all = meds ?? []
  const scheduled = all.filter((m) => m.kind === 'scheduled' && dosesDue(m, day) > 0)
  const asNeeded = all.filter((m) => m.kind === 'asneeded' && asNeededVisible(m, day))
  // Cycle meds on a break or off day: shown quietly so they don't look forgotten.
  const resting = all.filter((m) => {
    const s = scheduleOn(m, day)
    return m.kind === 'scheduled' && s?.pattern === 'cycle' && isVisibleOn(m, day) && dosesDue(m, day) === 0 &&
      day >= s.startDate && (!s.endDate || day <= s.endDate)
  })
  const taken = new Set(logs.filter((l) => l.slot >= 0).map((l) => `${l.medId}|${l.slot}`))
  const due = scheduled.reduce((n, m) => n + dosesDue(m, day), 0)
  const done = scheduled.reduce((n, m) => n + Array.from({ length: dosesDue(m, day) }, (_, s) => taken.has(`${m.id}|${s}`)).filter(Boolean).length, 0)

  const toggleDose = async (med: Med, slot: number) => {
    const id = `${med.id}|${day}|${slot}`
    if (await db.medLogs.get(id)) await db.medLogs.delete(id)
    else await db.medLogs.put({ id, medId: med.id, day, slot, at: momentOn(day, today) })
  }
  const logAsNeeded = (med: Med) => db.medLogs.add({ id: uid(), medId: med.id, day, slot: -1, at: momentOn(day, today) })

  const hasAnyMeds = all.some((m) => !m.archivedFrom || m.archivedFrom > today)

  return (
    <>
      <TopBar title="Medications" actions={<>
        <IconButton label="Overview" onClick={() => setOverview(true)}><CalendarIcon size={22} /></IconButton>
        <IconButton label="Add medication" tinted onClick={() => setEditing('new')}><PlusIcon size={22} strokeWidth={2.4} /></IconButton>
      </>} />
      <Page>
        <DayNav day={day} today={today} onChange={setDay} />
        {future && <FutureNotice />}

        {meds && !hasAnyMeds && !scheduled.length && !asNeeded.length ? (
          <Card className="animate-rise-in">
            <EmptyState icon={<PillIcon size={28} />} title="No medications yet"
              action={<Button small onClick={() => setEditing('new')}><PlusIcon size={18} /> Add medication</Button>}>
              Add your scheduled meds and as-needed ones. Each dose becomes a checkbox here.
            </EmptyState>
          </Card>
        ) : (
          <div className="stagger flex flex-col gap-3" key={day}>
            {due > 0 && (
              <Card className="flex items-center gap-4">
                <Ring value={done} max={due} size={60} stroke={7}>
                  {done === due ? <CheckIcon size={24} strokeWidth={3} className="text-accent" /> : <span className="text-[15px] font-bold tabular">{done}/{due}</span>}
                </Ring>
                <div className="min-w-0">
                  <p className="text-[17px] font-semibold">{done === due ? (due === 1 ? 'Dose taken' : 'All doses taken') : `${done} of ${due} ${due === 1 ? 'dose' : 'doses'} taken`}</p>
                  <p className="text-[14px] text-muted">
                    {done === due ? 'Nothing left for this day.' : ended ? `${due - done} missed` : `${due - done} still to take`}
                  </p>
                </div>
              </Card>
            )}

            {scheduled.length === 0 && resting.length === 0 && meds && (
              <Card><EmptyState title="Nothing scheduled">No scheduled doses on this day.</EmptyState></Card>
            )}

            {scheduled.map((med) => {
              const n = dosesDue(med, day)
              return (
                <Card key={med.id}>
                  <div className="flex items-center gap-3">
                    <IconBadge><PillIcon size={21} /></IconBadge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[17px] font-semibold">{med.name}</p>
                      <p className="text-[13px] text-muted">{describeSchedule(med, day)}</p>
                    </div>
                    <IconButton label={`Edit ${med.name}`} onClick={() => setEditing(med)}><DotsIcon size={22} /></IconButton>
                  </div>
                  <div className={`mt-3 grid gap-2 ${n === 1 ? 'grid-cols-1' : n === 2 || n === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {Array.from({ length: n }, (_, slot) => {
                      const log = logs.find((l) => l.medId === med.id && l.slot === slot)
                      const missed = !log && ended
                      return (
                        <button key={slot} type="button" disabled={future} onClick={() => toggleDose(med, slot)}
                          aria-pressed={!!log}
                          className={`pressable flex min-h-[54px] items-center gap-2 rounded-2xl px-3 text-left transition-colors duration-200 disabled:opacity-50 ${log ? 'bg-accent text-white' : missed ? 'bg-danger-soft text-danger' : 'bg-surface-2'}`}>
                          <span key={String(!!log)} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${log ? 'animate-pop bg-white/25' : missed ? 'border-2 border-danger/50' : 'border-2 border-faint'}`}>
                            {log && <CheckIcon size={15} strokeWidth={3.2} />}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[15px] font-semibold leading-tight">Dose {slot + 1}</span>
                            <span className={`block text-[12px] leading-tight ${log ? 'text-white/80' : 'text-muted'} ${missed ? 'text-danger' : ''}`}>
                              {log ? fmtTime(new Date(log.at)) : missed ? 'Missed' : 'Tap when taken'}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </Card>
              )
            })}

            {resting.length > 0 && <SectionLabel>Not today</SectionLabel>}
            {resting.map((med) => {
              const next = nextDoseDay(med, addDays(day, 1))
              return (
                <Card key={med.id} onClick={() => setEditing(med)} className="flex items-center gap-3 py-3">
                  <IconBadge color="var(--muted)"><PillIcon size={20} /></IconBadge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold">{med.name}</p>
                    <p className="text-[13px] text-muted">{describeCycleDay(scheduleOn(med, day)!, day)}</p>
                  </div>
                  {next && (
                    <div className="text-right">
                      <p className="text-[12px] text-muted">Next dose</p>
                      <p className="text-[14px] font-semibold text-accent">{dueLabel(next, today)}</p>
                    </div>
                  )}
                </Card>
              )
            })}

            {asNeeded.length > 0 && <SectionLabel>As needed</SectionLabel>}
            {asNeeded.map((med) => <AsNeededCard key={med.id} med={med} logs={logs.filter((l) => l.medId === med.id)}
              locked={future} onLog={() => logAsNeeded(med)} onEdit={() => setEditing(med)} />)}
          </div>
        )}
      </Page>

      <MedForm open={editing !== null} med={editing === 'new' ? null : editing} today={today} count={all.length} onClose={() => setEditing(null)} />
      <MedsOverview open={overview} onClose={() => setOverview(false)} today={today} onPick={(d) => { setDay(d); setOverview(false) }} />
    </>
  )
}

function AsNeededCard({ med, logs, locked, onLog, onEdit }: { med: Med; logs: MedLog[]; locked: boolean; onLog: () => void; onEdit: () => void }) {
  const sorted = [...logs].sort((a, b) => a.at - b.at)
  return (
    <Card>
      <div className="flex items-center gap-3">
        <IconBadge color="var(--muted)"><PillIcon size={21} /></IconBadge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{med.name}</p>
          <p className="text-[13px] text-muted">{sorted.length ? `Taken ${sorted.length}× this day` : 'Not taken this day'}</p>
        </div>
        <IconButton label={`Edit ${med.name}`} onClick={onEdit}><DotsIcon size={22} /></IconButton>
      </div>
      {sorted.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sorted.map((l) => (
            <span key={l.id} className="animate-pop flex items-center gap-1 rounded-full bg-accent-soft py-1 pr-1 pl-3 text-[14px] font-semibold text-accent tabular">
              {fmtTime(new Date(l.at))}
              <button type="button" aria-label="Remove dose" disabled={locked} onClick={() => db.medLogs.delete(l.id)}
                className="flex h-7 w-7 items-center justify-center rounded-full active:bg-accent-soft"><XIcon size={14} strokeWidth={2.6} /></button>
            </span>
          ))}
        </div>
      )}
      <Button variant="tinted" className="mt-3 w-full" disabled={locked} onClick={onLog}><PlusIcon size={20} /> Log dose</Button>
    </Card>
  )
}

function MedsOverview({ open, onClose, today, onPick }: { open: boolean; onClose: () => void; today: DayKey; onPick: (d: DayKey) => void }) {
  const [range, setRange] = useState(() => monthRange(today))
  const meds = useLiveQuery(() => db.meds.toArray()) ?? []
  const logs = useLiveQuery(() => db.medLogs.where('day').between(range.start, range.end, true, true).toArray(), [range.start, range.end]) ?? []
  const ended = range.days.filter((d) => d < today)
  const missed = missedDays(meds, logs, ended)
  return (
    <Sheet open={open} onClose={onClose} title="Overview">
      <MonthCalendar today={today} tone={(d) => (missed.has(d) ? 'missed' : null)} onPick={onPick}
        onMonthChange={(start) => setRange(monthRange(start))} />
      <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-muted">
        <span className="h-3 w-3 rounded-full bg-danger" /> Missed a scheduled dose
        <span className="ml-1">{missed.size ? `· ${missed.size} this month` : '· none this month'}</span>
      </div>
    </Sheet>
  )
}
