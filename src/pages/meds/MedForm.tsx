import { useEffect, useState } from 'react'
import { db, uid, type Med, type MedPattern } from '../../lib/db'
import type { DayKey } from '../../lib/day'
import { scheduleOn, withScheduleFrom } from '../../lib/meds'
import { ArchiveIcon } from '../../components/Icons'
import { MonthCalendar } from '../../components/MonthCalendar'
import { ConfirmSheet, Sheet, SheetAction } from '../../components/Sheet'
import { Field, Segmented, Stepper, TextInput, Toggle, inputCls } from '../../components/ui'

interface Props { open: boolean; med: Med | null; today: DayKey; count: number; onClose: () => void }

export function MedForm({ open, med, today, count, onClose }: Props) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Med['kind']>('scheduled')
  const [pattern, setPattern] = useState<MedPattern>('daily')
  const [customDays, setCustomDays] = useState<DayKey[]>([])
  const [doses, setDoses] = useState(1)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState<DayKey | null>(null)
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
  }, [open, med, today])

  const valid = name.trim() && (kind === 'asneeded' || pattern !== 'custom' || customDays.length > 0)

  const save = async () => {
    if (!valid) return
    const schedule = {
      pattern: kind === 'asneeded' ? 'daily' as const : pattern,
      customDays: pattern === 'custom' ? [...customDays].sort() : [],
      dosesPerDay: kind === 'asneeded' ? 1 : doses,
      startDate: pattern === 'custom' && kind === 'scheduled' ? [...customDays].sort()[0] : startDate,
      endDate: pattern === 'custom' && kind === 'scheduled' ? null : endDate,
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
                  { value: 'alternate', label: 'Every other' },
                  { value: 'custom', label: 'Custom' },
                ]} />
              </Field>

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
              <Field label="Start date">
                <input type="date" className={inputCls} value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
              </Field>
              <div className="flex min-h-[50px] items-center justify-between rounded-2xl bg-surface-2 pr-2 pl-4">
                <span className="text-[16px]">No end date</span>
                <Toggle checked={endDate === null} onChange={(v) => setEndDate(v ? null : startDate > today ? startDate : today)} label="No end date" />
              </div>
              {endDate !== null && (
                <Field label="End date">
                  <input type="date" className={`${inputCls} animate-fade-in`} min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value || null)} />
                </Field>
              )}
            </div>
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
