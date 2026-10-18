import { useEffect, useState } from 'react'
import { db, uid, type CyclePhase, type Med, type MedPattern } from '../../lib/db'
import { addDays, daysBetween, type DayKey } from '../../lib/day'
import { cycleDays, describePhase, dosesDue, phaseDays, scheduleOn, withScheduleFrom } from '../../lib/meds'
import { ArchiveIcon, PlusIcon, XIcon } from '../../components/Icons'
import { MonthCalendar } from '../../components/MonthCalendar'
import { ConfirmSheet, Sheet, SheetAction } from '../../components/Sheet'
import { Field, Segmented, Stepper, TextInput, Toggle, inputCls } from '../../components/ui'

interface Props { open: boolean; med: Med | null; today: DayKey; count: number; onClose: () => void }

/** The prescription this feature was built for; a sensible starting point to edit. */
const DEFAULT_CYCLE: CyclePhase[] = [
  { length: 1, unit: 'weeks', mode: 'daily' },
  { length: 2, unit: 'weeks', mode: 'alternate' },
  { length: 3, unit: 'weeks', mode: 'off' },
]

const MODES: { value: CyclePhase['mode']; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'alternate', label: 'Every other day' },
  { value: 'off', label: 'Break' },
]

const MODE_COLOR: Record<CyclePhase['mode'], string> = {
  daily: 'var(--accent)',
  alternate: 'color-mix(in srgb, var(--accent) 50%, transparent)',
  off: 'var(--faint)',
}

export function MedForm({ open, med, today, count, onClose }: Props) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Med['kind']>('scheduled')
  const [pattern, setPattern] = useState<MedPattern>('daily')
  const [customDays, setCustomDays] = useState<DayKey[]>([])
  const [doses, setDoses] = useState(1)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState<DayKey | null>(null)
  const [cycle, setCycle] = useState<CyclePhase[]>(DEFAULT_CYCLE)
  const [confirmArchive, setConfirmArchive] = useState(false)

  useEffect(() => {
    if (!open) return
    const s = med ? scheduleOn(med, today) : null
    setName(med?.name ?? '')
    setKind(med?.kind ?? 'scheduled')
    setPattern(s?.pattern ?? 'daily')
    setCustomDays(s?.customDays ?? [])
    setDoses(s?.dosesPerDay ?? 1)
    setStartDate(s?.startDate ?? today)
    setEndDate(s?.endDate ?? null)
    setCycle(s?.cycle?.length ? s.cycle : DEFAULT_CYCLE)
  }, [open, med, today])

  const isCycle = kind === 'scheduled' && pattern === 'cycle'
  const cycleOk = cycle.some((p) => p.mode !== 'off') && cycleDays(cycle) > 0
  const valid = name.trim() && (kind === 'asneeded' || (pattern !== 'custom' || customDays.length > 0) && (pattern !== 'cycle' || cycleOk))

  const save = async () => {
    if (!valid) return
    const schedule = {
      pattern: kind === 'asneeded' ? 'daily' as const : pattern,
      customDays: pattern === 'custom' ? [...customDays].sort() : [],
      dosesPerDay: kind === 'asneeded' ? 1 : doses,
      startDate: pattern === 'custom' && kind === 'scheduled' ? [...customDays].sort()[0] : startDate,
      endDate: pattern === 'custom' && kind === 'scheduled' ? null : endDate,
      ...(isCycle ? { cycle } : {}),
    }
    if (med) {
      await db.meds.update(med.id, { name: name.trim(), schedules: withScheduleFrom(med, schedule, today) })
    } else {
      await db.meds.add({
        id: uid(), name: name.trim(), kind, archivedFrom: null, order: count, createdAt: Date.now(),
        schedules: [{ ...schedule, effectiveFrom: '0000-01-01' }],
      })
    }
    onClose()
  }

  const toggleCustom = (d: DayKey) => setCustomDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))

  return (
    <>
      <Sheet open={open} onClose={onClose} title={med ? 'Edit medication' : 'New medication'}
        action={<SheetAction onClick={save} disabled={!valid}>{med ? 'Save' : 'Add'}</SheetAction>}>
        <div className="flex flex-col gap-5">
          <Field label="Name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ibuprofen 400 mg" autoFocus={!med} enterKeyHint="done" />
          </Field>

          {!med && (
            <Field label="Type">
              <Segmented value={kind} onChange={setKind} options={[{ value: 'scheduled', label: 'Scheduled' }, { value: 'asneeded', label: 'As needed' }]} />
            </Field>
          )}

          {kind === 'scheduled' && (
            <>
              <Field label="Days">
                <Segmented value={pattern} onChange={setPattern} options={[
                  { value: 'daily', label: 'Daily' },
                  { value: 'alternate', label: 'Alternate' },
                  { value: 'custom', label: 'Pick days' },
                  { value: 'cycle', label: 'Cycle' },
                ]} />
              </Field>

              {pattern === 'cycle' && <CycleEditor cycle={cycle} onChange={setCycle} />}

              {pattern === 'custom' && (
                <div className="animate-fade-in rounded-[22px] bg-surface-2/60 p-3">
                  <MonthCalendar today={today} initial={customDays[0] ?? today} allowFuture onPick={toggleCustom}
                    tone={(d) => (customDays.includes(d) ? 'selected' : null)} />
                  <p className="pt-2 text-center text-[13px] text-muted">
                    {customDays.length ? `${customDays.length} day${customDays.length === 1 ? '' : 's'} selected` : 'Tap days to select them'}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[16px] font-medium">Doses per day</p>
                  <p className="text-[13px] text-muted">{doses === 1 ? 'One checkbox a day' : `Dose 1 – Dose ${doses}`}</p>
                </div>
                <Stepper value={doses} onChange={setDoses} min={1} max={8} />
              </div>
            </>
          )}

          {(kind === 'asneeded' || pattern !== 'custom') && (
            <div className="flex flex-col gap-3">
              <Field label={isCycle ? 'Cycle starts on' : 'Start date'} hint={isCycle ? 'The first day of the first phase.' : undefined}>
                <input type="date" className={inputCls} value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
              </Field>
              <div className="flex min-h-[50px] items-center justify-between rounded-2xl bg-surface-2 pr-2 pl-4">
                <span className="text-[16px]">{isCycle ? 'Repeat forever' : 'No end date'}</span>
                <Toggle checked={endDate === null} label={isCycle ? 'Repeat forever' : 'No end date'}
                  onChange={(v) => setEndDate(v ? null : isCycle ? addDays(startDate, cycleDays(cycle) * 3 - 1) : startDate > today ? startDate : today)} />
              </div>
              {endDate !== null && (
                <Field label={isCycle ? 'Repeat until' : 'End date'} hint={isCycle ? roundsHint(startDate, endDate, cycle) : undefined}>
                  <input type="date" className={`${inputCls} animate-fade-in`} min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value || null)} />
                </Field>
              )}
            </div>
          )}

          {isCycle && cycleOk && (
            <Field label="Preview">
              <div className="rounded-[22px] bg-surface-2/60 p-3">
                <MonthCalendar key={startDate} today={today} initial={startDate > today ? startDate : today} allowFuture
                  tone={(d) => (dosesDue(previewMed(cycle, startDate, endDate, doses), d) > 0 ? 'selected' : null)} />
                <p className="pt-2 text-center text-[13px] text-muted">Highlighted days are dose days</p>
              </div>
            </Field>
          )}

          {med && (
            <>
              <p className="px-1 text-[13px] leading-snug text-muted">Schedule changes apply from today on. Past days keep their history.</p>
              <button type="button" onClick={() => setConfirmArchive(true)}
                className="pressable flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-danger-soft text-[16px] font-semibold text-danger">
                <ArchiveIcon size={20} /> Remove medication
              </button>
            </>
          )}
        </div>
      </Sheet>
      <ConfirmSheet open={confirmArchive} onClose={() => setConfirmArchive(false)} title={`Remove ${med?.name ?? ''}?`}
        message="It disappears from today on. Past days and the overview keep its history."
        confirmLabel="Remove" onConfirm={async () => { if (med) await db.meds.update(med.id, { archivedFrom: today }); onClose() }} />
    </>
  )
}

/** A throwaway med carrying the form's cycle, so the preview uses the real scheduling logic. */
function previewMed(cycle: CyclePhase[], startDate: DayKey, endDate: DayKey | null, doses: number): Med {
  return {
    id: 'preview', name: '', kind: 'scheduled', archivedFrom: null, order: 0, createdAt: 0,
    schedules: [{ effectiveFrom: '0000-01-01', pattern: 'cycle', customDays: [], dosesPerDay: doses, startDate, endDate, cycle }],
  }
}

function roundsHint(start: DayKey, end: DayKey, cycle: CyclePhase[]): string {
  const total = cycleDays(cycle)
  if (!total || end < start) return ''
  const days = daysBetween(start, end) + 1
  const rounds = days / total
  const whole = Math.floor(rounds)
  return Number.isInteger(rounds)
    ? `Exactly ${whole} full cycle${whole === 1 ? '' : 's'}.`
    : `${whole} full cycle${whole === 1 ? '' : 's'}, then part of another.`
}

/** Build a repeating cycle from phases: length, unit and what happens in it. */
function CycleEditor({ cycle, onChange }: { cycle: CyclePhase[]; onChange: (c: CyclePhase[]) => void }) {
  const total = cycleDays(cycle)
  const set = (i: number, patch: Partial<CyclePhase>) => onChange(cycle.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const totalLabel = total % 7 === 0 ? `${total / 7} week${total === 7 ? '' : 's'}` : `${total} day${total === 1 ? '' : 's'}`

  return (
    <div className="animate-fade-in flex flex-col gap-3">
      {total > 0 && (
        <div>
          <div className="flex h-3 gap-[3px] overflow-hidden rounded-full">
            {cycle.map((p, i) => <div key={i} className="h-full rounded-full transition-[flex-grow] duration-300" style={{ flexGrow: phaseDays(p), background: MODE_COLOR[p.mode] }} />)}
          </div>
          <p className="mt-1.5 px-1 text-[13px] text-muted">
            One cycle is <span className="font-semibold text-text">{totalLabel}</span>: {cycle.map(describePhase).join(', then ')}. Then it repeats.
          </p>
        </div>
      )}

      {cycle.map((p, i) => (
        <div key={i} className="rounded-[20px] bg-surface-2/70 p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: MODE_COLOR[p.mode] }} /> Phase {i + 1}
            </span>
            {cycle.length > 1 && (
              <button type="button" aria-label={`Remove phase ${i + 1}`} onClick={() => onChange(cycle.filter((_, j) => j !== i))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-surface"><XIcon size={16} /></button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Stepper value={p.length} min={1} max={p.unit === 'weeks' ? 52 : 90} onChange={(length) => set(i, { length })} />
            <div className="flex-1">
              <Segmented size="sm" value={p.unit} onChange={(unit) => set(i, { unit })}
                options={[{ value: 'days', label: p.length === 1 ? 'Day' : 'Days' }, { value: 'weeks', label: p.length === 1 ? 'Week' : 'Weeks' }]} />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {MODES.map((m) => (
              <button key={m.value} type="button" aria-pressed={p.mode === m.value} onClick={() => set(i, { mode: m.value })}
                className={`pressable min-h-10 rounded-[12px] px-1 text-[13px] font-semibold transition-colors ${p.mode === m.value ? (m.value === 'off' ? 'bg-text text-bg' : 'bg-accent text-white') : 'bg-surface text-text'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button type="button" onClick={() => onChange([...cycle, { length: 1, unit: 'weeks', mode: 'daily' }])}
        className="pressable flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-accent-soft text-[15px] font-semibold text-accent">
        <PlusIcon size={18} /> Add phase
      </button>
      {!cycle.some((p) => p.mode !== 'off') && <p className="px-1 text-[13px] text-danger">A cycle needs at least one phase with doses.</p>}
    </div>
  )
}
