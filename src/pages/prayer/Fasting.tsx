import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, type Fast, type FastType } from '../../lib/db'
import { daysBetween, longDate, parseKey, weekdayName, type DayKey } from '../../lib/day'
import { FAST_TYPES, isForbiddenFastDay, isRamadan, missedRamadanDays, qadaFastCount, sunnahHints, upcomingHints } from '../../lib/fasting'
import { HIJRI_MONTHS, formatHijri, hijriMonthDays, hijriOf } from '../../lib/hijri'
import { setSetting, useSettings } from '../../lib/settings'
import { dueLabel } from '../../lib/todo'
import { useToday } from '../../lib/useToday'
import { CheckIcon, ChevronLeft, ChevronRight, MoonIcon } from '../../components/Icons'
import { MonthCalendar } from '../../components/MonthCalendar'
import { Sheet, SheetAction } from '../../components/Sheet'
import { Card, Field, Page, SectionLabel, TextInput } from '../../components/ui'

const typeMeta = (t: FastType) => FAST_TYPES.find((x) => x.value === t)!

export function FastingSection() {
  const settings = useSettings()
  const today = useToday()
  const fasts = useLiveQuery(() => db.fasts.toArray())
  const [editing, setEditing] = useState<DayKey | null>(null)
  const offset = settings?.hijriOffset ?? 0

  // Missed Ramadan days only count from the first time this section was opened.
  useEffect(() => {
    if (settings && !settings.fastingTrackingStart) setSetting('fastingTrackingStart', today)
  }, [settings, today])

  if (!settings || !fasts) return null
  const byDay = new Map(fasts.map((f) => [f.day, f]))
  const h = hijriOf(today, offset)
  const forbidden = isForbiddenFastDay(today, offset)
  const hints = sunnahHints(today, offset)
  const todayFast = byDay.get(today)
  const missed = missedRamadanDays(fasts, settings.fastingTrackingStart, today, offset)
  const owed = qadaFastCount(settings.qadaFastBase, missed.length, fasts)

  return (
    <Page>
      <div className="stagger flex flex-col gap-3">
        <div className="relative overflow-hidden rounded-[26px] p-5 text-white shadow-[0_12px_32px_-14px_var(--c-prayer)]"
          style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #3b37b8 55%, #6d5dfc 100%)' }}>
          <div className="pointer-events-none absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/10" />
          <p className="relative text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">{weekdayName(today)}, {longDate(today)}</p>
          <p className="relative mt-1 text-[28px] leading-tight font-bold">{formatHijri(h)}</p>
          <p className="relative mt-1 text-[14px] text-white/85">
            {forbidden ? `${forbidden}: no fasting today` : isRamadan(today, offset) ? `Ramadan, day ${h.day}` : hints.length ? `Sunnah fast: ${hints.map((x) => x.label).join(' · ')}` : 'No special fast today'}
          </p>
          <div className="relative mt-4">
            {todayFast ? (
              <button type="button" onClick={() => setEditing(today)} className="pressable inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-[#1e1b4b]">
                <CheckIcon size={17} strokeWidth={3} /> Fasting today · {typeMeta(todayFast.type).label}
              </button>
            ) : !forbidden && (
              <button type="button" onClick={() => setEditing(today)} className="pressable inline-flex rounded-full bg-white/20 px-4 py-2 text-[15px] font-semibold">
                Mark today as fasted
              </button>
            )}
          </div>
        </div>

        <QadaFastCard owed={owed} base={settings.qadaFastBase} autoMissed={missed.length} />

        <RamadanGrid fasts={byDay} today={today} offset={offset} trackingStart={settings.fastingTrackingStart} />

        <SectionLabel>Your fasts</SectionLabel>
        <Card>
          <MonthCalendar today={today} onPick={setEditing}
            tone={(d) => (byDay.has(d) ? 'done' : missed.includes(d) ? 'missed' : null)}
            dot={(d) => !byDay.has(d) && sunnahHints(d, offset).length > 0} />
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] text-muted">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-accent" /> Fasted</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-danger" /> Missed Ramadan</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-text" /> Sunnah fast day</span>
          </div>
        </Card>

        <SectionLabel>Upcoming sunnah fasts</SectionLabel>
        <div className="rounded-[22px] bg-surface px-4 py-1 shadow-card">
          {upcomingHints(today, 6, offset).map(({ day, hints: hs }) => {
            const hd = hijriOf(day, offset)
            return (
              <div key={day} className="flex min-h-[58px] items-center gap-3 border-b border-line py-2 last:border-0">
                <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-[13px] bg-success-soft text-success">
                  <span className="text-[16px] leading-none font-bold tabular">{parseKey(day).getDate()}</span>
                  <span className="text-[10px] font-semibold uppercase">{parseKey(day).toLocaleDateString('en-GB', { month: 'short' })}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{hs.map((x) => x.label).join(' · ')}</span>
                  <span className="block text-[12px] text-muted">{dueLabel(day, today)} · {hd.day} {HIJRI_MONTHS[hd.month - 1]}</span>
                </span>
                {byDay.has(day) && <CheckIcon size={18} strokeWidth={3} className="text-success" />}
              </div>
            )
          })}
        </div>
        <p className="px-4 text-center text-[12px] text-muted">
          Hijri dates use the Umm al-Qura calendar{offset ? `, adjusted by ${offset > 0 ? '+' : ''}${offset} day${Math.abs(offset) === 1 ? '' : 's'}` : ''}. Adjust in Settings to match your local moon sighting.
        </p>
      </div>

      <FastSheet day={editing} fast={editing ? byDay.get(editing) : undefined} offset={offset} onClose={() => setEditing(null)} />
    </Page>
  )
}

function FastSheet({ day, fast, offset, onClose }: { day: DayKey | null; fast: Fast | undefined; offset: number; onClose: () => void }) {
  const open = day !== null
  const forbidden = day ? isForbiddenFastDay(day, offset) : null
  const inRamadan = day ? isRamadan(day, offset) : false
  const set = async (type: FastType | null) => {
    if (!day) return
    if (type) await db.fasts.put({ day, type })
    else await db.fasts.delete(day)
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title={day ? `${weekdayName(day)}, ${longDate(day)}` : ''}>
      {day && (
        <div className="flex flex-col gap-3">
          <p className="text-center text-[14px] text-muted">{formatHijri(hijriOf(day, offset))}</p>
          {forbidden && <p className="rounded-2xl bg-danger-soft px-4 py-3 text-center text-[14px] font-medium text-danger">{forbidden}: fasting isn’t permitted on this day.</p>}
          {!forbidden && sunnahHints(day, offset).length > 0 && (
            <p className="rounded-2xl bg-success-soft px-4 py-3 text-center text-[14px] font-medium text-success">Sunnah fast day: {sunnahHints(day, offset).map((x) => x.label).join(' · ')}</p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {FAST_TYPES.filter((t) => t.value !== 'ramadan' || inRamadan).map((t) => {
              const active = fast?.type === t.value
              return (
                <button key={t.value} type="button" onClick={() => set(t.value)}
                  className={`pressable flex min-h-[56px] items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold ${active ? 'text-white' : 'bg-surface-2'}`}
                  style={active ? { background: t.color } : undefined}>
                  {active && <CheckIcon size={18} strokeWidth={3} />}{t.label}
                </button>
              )
            })}
          </div>
          {fast && (
            <button type="button" onClick={() => set(null)} className="pressable min-h-[50px] rounded-2xl bg-surface-2 text-[16px] font-semibold text-muted">Not fasted</button>
          )}
          <p className="px-1 text-center text-[12px] text-muted">A Qada fast takes one off the fasts you owe.</p>
        </div>
      )}
    </Sheet>
  )
}

function QadaFastCard({ owed, base, autoMissed }: { owed: number; base: number; autoMissed: number }) {
  const [edit, setEdit] = useState(false)
  const [value, setValue] = useState('')
  return (
    <Card>
      <button type="button" onClick={() => { setValue(String(owed)); setEdit(true) }} className="pressable flex w-full items-center gap-4 text-left">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-warning-soft text-warning"><MoonIcon size={24} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">Qada fasts</span>
          <span className="block text-[15px] text-muted">{owed === 1 ? 'fast owed' : 'fasts owed'} · tap to set</span>
        </span>
        <span className="text-[38px] leading-none font-bold tabular">{owed}</span>
      </button>
      <p className="mt-3 border-t border-line pt-3 text-[13px] leading-snug text-muted">
        Missed Ramadan days are added automatically{autoMissed ? ` (${autoMissed} so far)` : ''}. Marking a day as a Qada fast takes one off.
      </p>
      <Sheet open={edit} onClose={() => setEdit(false)} title="Fasts owed"
        action={<SheetAction disabled={!/^\d+$/.test(value)} onClick={() => { setSetting('qadaFastBase', base + (parseInt(value, 10) - owed)); setEdit(false) }}>Save</SheetAction>}>
        <Field label="Current number of fasts you owe" hint="From here on the counter keeps itself up to date.">
          <TextInput inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} autoFocus className="text-[22px] font-semibold tabular" />
        </Field>
      </Sheet>
    </Card>
  )
}

/** Every day of one Ramadan; tap a past day to toggle it as fasted. */
function RamadanGrid({ fasts, today, offset, trackingStart }: { fasts: Map<DayKey, Fast>; today: DayKey; offset: number; trackingStart: DayKey | null }) {
  const h = hijriOf(today, offset)
  // In or just after Ramadan show this year's; otherwise the coming one.
  const [year, setYear] = useState(h.month <= 10 ? h.year : h.year + 1)
  const days = hijriMonthDays(year, 9, offset)
  const fasted = days.filter((d) => fasts.has(d)).length
  const missed = days.filter((d) => d < today && !fasts.has(d) && !!trackingStart && d >= trackingStart).length
  const toggle = (d: DayKey) => {
    if (d > today) return
    if (fasts.has(d)) db.fasts.delete(d)
    else db.fasts.put({ day: d, type: 'ramadan' })
  }
  const startsIn = days.length && days[0] > today ? daysBetween(today, days[0]) : null

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" aria-label="Previous Ramadan" onClick={() => setYear(year - 1)} className="pressable flex h-10 w-10 items-center justify-center rounded-full text-accent"><ChevronLeft size={22} /></button>
        <div className="text-center">
          <p className="text-[17px] font-semibold">Ramadan {year}</p>
          {days.length > 0 && <p className="text-[12px] text-muted">{longDate(days[0])} – {longDate(days.at(-1)!)}</p>}
        </div>
        <button type="button" aria-label="Next Ramadan" onClick={() => setYear(year + 1)} className="pressable flex h-10 w-10 items-center justify-center rounded-full text-accent"><ChevronRight size={22} /></button>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {days.map((d, i) => {
          const done = fasts.has(d)
          const future = d > today
          const tracked = !!trackingStart && d >= trackingStart
          const isMissed = !done && !future && tracked
          const cls = done ? 'bg-accent text-white' : isMissed ? 'bg-danger-soft text-danger ring-1 ring-danger/40 ring-inset' : future ? 'bg-surface-2 text-muted' : 'bg-surface-2 text-faint'
          return (
            <button key={d} type="button" disabled={future} onClick={() => toggle(d)} aria-pressed={done} aria-label={`Ramadan ${i + 1}, ${longDate(d)}`}
              className={`pressable flex aspect-square flex-col items-center justify-center rounded-[14px] transition-colors ${cls} ${d === today ? 'ring-2 ring-accent' : ''}`}>
              <span className="text-[15px] leading-none font-bold tabular">{i + 1}</span>
              <span className="mt-0.5 text-[9px] leading-none opacity-75 tabular">{parseKey(d).getDate()}/{parseKey(d).getMonth() + 1}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-center text-[13px] text-muted">
        {startsIn !== null ? `Starts in ${startsIn} day${startsIn === 1 ? '' : 's'}` : `${fasted} fasted${missed ? ` · ${missed} missed, added to qada` : ''}`}
      </p>
    </Card>
  )
}
