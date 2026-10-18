import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, type SplitDay } from '../../lib/db'
import { addDays, daysBetween, weekdayOf, type DayKey } from '../../lib/day'
import { anchorsAfterReset, plannedSplit, splitFor, trainingStreak } from '../../lib/fitness'
import { useSelectedDay } from '../../lib/hooks'
import { APPS, openApp } from '../../lib/intents'
import { setSetting, useSettings, type Settings } from '../../lib/settings'
import { useToday } from '../../lib/useToday'
import { DayNav, FutureNotice } from '../../components/DayNav'
import { CalendarIcon, CheckIcon, DumbbellIcon, ExternalIcon, FlameIcon, PencilIcon, RepeatIcon } from '../../components/Icons'
import { MonthCalendar } from '../../components/MonthCalendar'
import { Sheet } from '../../components/Sheet'
import { IconButton, TopBar } from '../../components/TopBar'
import { Button, Card, EmptyState, Page, SectionLabel } from '../../components/ui'
import { BodyweightCard } from './Bodyweight'
import { LyftaStats } from './LyftaStats'
import { NutritionCard } from './Nutrition'
import { SplitEditor } from './SplitEditor'

const WEEK_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function Fitness() {
  const today = useToday()
  const [day, setDay] = useSelectedDay(today)
  const settings = useSettings()
  const splits = useLiveQuery(() => db.splitDays.orderBy('order').toArray())
  const logs = useLiveQuery(() => db.trainingDays.toArray()) ?? []
  const [editSplit, setEditSplit] = useState(false)
  const [change, setChange] = useState(false)
  const [calendar, setCalendar] = useState(false)

  if (!settings || !splits) return <TopBar title="Fitness" />
  const future = day > today
  const log = logs.find((l) => l.day === day)
  const split = splitFor(settings, splits, day, log)
  const planned = plannedSplit(settings, splits, day)
  const swapped = settings.splitMode === 'weekday' && !!log?.splitDayId && log.splitDayId !== planned?.id
  const trained = !!log?.trained
  const streak = trainingStreak(settings, splits, logs, today)
  const byDay = new Map(logs.map((l) => [l.day, l]))

  const toggleTrained = () => db.trainingDays.put({ day, splitDayId: log?.splitDayId ?? null, trained: !trained })

  const pick = async (s: SplitDay) => {
    if (settings.splitMode === 'weekday') {
      await db.trainingDays.put({ day, splitDayId: s.id === planned?.id ? null : s.id, trained })
    } else {
      await setSetting('cycleAnchors', anchorsAfterReset(settings.cycleAnchors.length ? settings.cycleAnchors : [{ day, index: 0 }], day, splits.indexOf(s)))
    }
    setChange(false)
  }

  return (
    <>
      <TopBar title="Fitness" actions={<>
        <IconButton label="Training calendar" onClick={() => setCalendar(true)}><CalendarIcon size={22} /></IconButton>
        <button type="button" onClick={() => openApp(APPS.lyfta)}
          className="pressable flex h-9 items-center gap-1.5 rounded-full bg-accent-soft px-3 text-[14px] font-semibold text-accent">
          Lyfta <ExternalIcon size={15} strokeWidth={2.4} />
        </button>
      </>} />
      <Page>
        <DayNav day={day} today={today} onChange={setDay} />
        {future && <FutureNotice />}

        <div className="stagger flex flex-col gap-3" key={day}>
          {splits.length === 0 ? (
            <Card>
              <EmptyState icon={<DumbbellIcon size={28} />} title="Set up your split"
                action={<Button small onClick={() => setEditSplit(true)}>Create split days</Button>}>
                Add days like Push, Pull, Legs and Rest, then plan them by weekday or as a rotating cycle.
              </EmptyState>
            </Card>
          ) : (
            <TodayCard split={split} swapped={swapped} trained={trained} future={future} streak={streak}
              onTrained={toggleTrained} onChange={() => setChange(true)} onEdit={() => setEditSplit(true)}
              week={<WeekStrip settings={settings} splits={splits} day={day} today={today} byDay={byDay} onPick={setDay} />} />
          )}

          <SectionLabel>Nutrition</SectionLabel>
          <NutritionCard day={day} today={today} locked={future} kcalTarget={settings.kcalTarget} proteinTarget={settings.proteinTarget} />

          <SectionLabel>Body</SectionLabel>
          <BodyweightCard day={day} locked={future} />

          <SectionLabel>Lyfta</SectionLabel>
          <LyftaStats today={today} />
        </div>
      </Page>

      <SplitEditor open={editSplit} onClose={() => setEditSplit(false)} today={today} />

      <Sheet open={change} onClose={() => setChange(false)} title={day === today ? 'Change today' : 'Change this day'}>
        <p className="pb-4 text-center text-[14px] leading-snug text-muted">
          {settings.splitMode === 'weekday'
            ? 'A one-off swap for this day. Your weekly plan stays the same.'
            : 'Restart the cycle from the step you pick. The rotation continues from there.'}
        </p>
        <div className="flex flex-col gap-2">
          {splits.map((s, i) => (
            <button key={s.id} type="button" onClick={() => pick(s)}
              className={`pressable flex min-h-[58px] items-center gap-3 rounded-2xl px-4 text-left ${s.id === split?.id ? 'bg-accent text-white' : 'bg-surface-2'}`}>
              {settings.splitMode === 'cycle' && <span className={`text-[14px] font-semibold tabular ${s.id === split?.id ? 'text-white/70' : 'text-muted'}`}>{i + 1}</span>}
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold">{s.name}</span>
                <span className={`block text-[13px] ${s.id === split?.id ? 'text-white/75' : 'text-muted'}`}>
                  {s.rest ? 'Rest' : s.exercises.map((e) => e.name).join(', ') || 'No exercises'}
                </span>
              </span>
              {s.id === split?.id && <CheckIcon size={20} strokeWidth={3} />}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={calendar} onClose={() => setCalendar(false)} title="Training">
        <div className="mb-4 flex items-center justify-center gap-3 rounded-[20px] bg-accent-soft p-4">
          <FlameIcon size={30} className="text-accent" />
          <div>
            <p className="text-[24px] leading-none font-bold tabular">{streak} day{streak === 1 ? '' : 's'}</p>
            <p className="text-[13px] text-muted">Training streak (planned rest days don’t break it)</p>
          </div>
        </div>
        <MonthCalendar today={today} tone={(d) => (byDay.get(d)?.trained ? 'done' : null)}
          onPick={(d) => { setDay(d); setCalendar(false) }} />
        <p className="mt-3 text-center text-[13px] text-muted">
          {logs.filter((l) => l.trained && daysBetween(l.day, today) < 30).length} sessions in the last 30 days
        </p>
      </Sheet>
    </>
  )
}

function TodayCard({ split, swapped, trained, future, streak, onTrained, onChange, onEdit, week }: {
  split: SplitDay | null
  swapped: boolean
  trained: boolean
  future: boolean
  streak: number
  onTrained: () => void
  onChange: () => void
  onEdit: () => void
  week: React.ReactNode
}) {
  return (
    <div className={`relative overflow-hidden rounded-[26px] p-5 text-white transition-shadow ${trained ? 'shadow-[0_12px_32px_-14px_#16a34a]' : 'shadow-[0_12px_32px_-14px_var(--c-fitness)]'}`}
      style={{ background: trained ? 'linear-gradient(135deg, #12a150 0%, #22c55e 100%)' : 'linear-gradient(135deg, #e11d48 0%, #f2295b 50%, #fb7185 100%)' }}>
      <div className="pointer-events-none absolute -top-12 -right-10 h-44 w-44 rounded-full bg-white/10" />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/75">{swapped ? 'Swapped' : 'Split day'}</p>
            <p className="truncate text-[32px] leading-tight font-bold tracking-tight">{split?.name ?? 'Nothing planned'}</p>
          </div>
          <div className="flex items-center gap-1">
            {streak > 0 && <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[13px] font-semibold"><FlameIcon size={15} />{streak}</span>}
            <button type="button" onClick={onEdit} aria-label="Edit split" className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><PencilIcon size={17} /></button>
          </div>
        </div>

        {split && !split.rest && split.exercises.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {split.exercises.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 text-[15px]">
                <span className="truncate font-medium">{e.name}</span>
                {(e.sets || e.reps) && <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[13px] font-semibold tabular">{e.sets ?? '–'}×{e.reps ?? '–'}</span>}
              </li>
            ))}
          </ul>
        )}
        {split?.rest && <p className="mt-2 text-[15px] text-white/85">Recovery day. Rest days keep your streak going.</p>}

        <div className="mt-4">{week}</div>

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <button type="button" disabled={future} onClick={onTrained}
            className="pressable flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-white text-[16px] font-bold text-[#111] disabled:opacity-50">
            {trained ? <><CheckIcon size={20} strokeWidth={3} className="animate-pop text-[#16a34a]" /> Trained</> : 'Mark as trained'}
          </button>
          <button type="button" disabled={future} onClick={onChange}
            className="pressable flex min-h-[50px] items-center gap-1.5 rounded-2xl bg-white/20 px-4 text-[15px] font-semibold disabled:opacity-50">
            <RepeatIcon size={18} /> Change
          </button>
        </div>
      </div>
    </div>
  )
}

/** Seven days around the selected day: trained days filled, planned names below. */
function WeekStrip({ settings, splits, day, today, byDay, onPick }: {
  settings: Settings
  splits: SplitDay[]
  day: DayKey
  today: DayKey
  byDay: Map<DayKey, { trained: boolean; splitDayId: string | null; day: DayKey }>
  onPick: (d: DayKey) => void
}) {
  const monday = addDays(day, -((weekdayOf(day) + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d) => {
        const log = byDay.get(d)
        const s = splitFor(settings, splits, d, log)
        const sel = d === day
        return (
          <button key={d} type="button" onClick={() => onPick(d)} className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-semibold text-white/70">{WEEK_LETTERS[weekdayOf(d)]}</span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition-colors ${log?.trained ? 'bg-white text-[#111]' : sel ? 'bg-white/35' : 'bg-white/15'} ${d === today && !sel ? 'ring-2 ring-white/70' : ''}`}>
              {log?.trained ? <CheckIcon size={15} strokeWidth={3.2} /> : (s?.name ?? '·').slice(0, 1)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
