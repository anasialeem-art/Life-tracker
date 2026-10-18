import { useState, type ReactNode } from 'react'
import { calendarKey, parseKey, type DayKey } from '../lib/day'
import { ChevronLeft, ChevronRight } from './Icons'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export type DayTone = 'missed' | 'done' | 'selected' | null

interface MonthCalendarProps {
  today: DayKey
  /** Initially shown month (any day inside it). */
  initial?: DayKey
  tone?: (day: DayKey) => DayTone
  onPick?: (day: DayKey) => void
  /** Days after today can't be picked unless allowed. */
  allowFuture?: boolean
  /** Small marker under the day number. */
  dot?: (day: DayKey) => boolean
  footer?: (month: { start: DayKey; end: DayKey }) => ReactNode
  /** Called when the visible month changes (to load that month's data). */
  onMonthChange?: (start: DayKey, end: DayKey) => void
}

export function monthRange(anyDay: DayKey): { start: DayKey; end: DayKey; days: DayKey[] } {
  const d = parseKey(anyDay)
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const count = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const days = Array.from({ length: count }, (_, i) => calendarKey(new Date(first.getFullYear(), first.getMonth(), i + 1)))
  return { start: days[0], end: days[days.length - 1], days }
}

/** Month grid (weeks start Monday). Missed days are red; done days use the accent. */
export function MonthCalendar({ today, initial, tone, onPick, allowFuture, dot, footer, onMonthChange }: MonthCalendarProps) {
  const [cursor, setCursor] = useState(() => initial ?? today)
  const { start, end, days } = monthRange(cursor)
  const lead = (parseKey(start).getDay() + 6) % 7
  const label = parseKey(start).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  const shift = (n: number) => {
    const d = parseKey(start)
    const next = calendarKey(new Date(d.getFullYear(), d.getMonth() + n, 1))
    setCursor(next)
    const r = monthRange(next)
    onMonthChange?.(r.start, r.end)
  }

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => shift(-1)}
          className="pressable flex h-10 w-10 items-center justify-center rounded-full text-accent"><ChevronLeft size={22} /></button>
        <p className="text-[16px] font-semibold">{label}</p>
        <button type="button" aria-label="Next month" onClick={() => shift(1)}
          className="pressable flex h-10 w-10 items-center justify-center rounded-full text-accent"><ChevronRight size={22} /></button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w, i) => <span key={i} className="pb-1 text-[12px] font-semibold text-muted">{w}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {days.map((day) => {
          const t = tone?.(day) ?? null
          const future = day > today
          const disabled = !onPick || (future && !allowFuture)
          const isToday = day === today
          const cls =
            t === 'missed' ? 'bg-danger text-white font-semibold'
              : t === 'done' ? 'bg-accent text-white font-semibold'
                : t === 'selected' ? 'bg-accent text-white font-semibold'
                  : isToday ? 'text-accent font-bold ring-2 ring-accent ring-inset'
                    : future ? 'text-faint' : 'text-text'
          return (
            <div key={day} className="flex justify-center">
              <button type="button" disabled={disabled} onClick={() => onPick?.(day)}
                className={`pressable relative flex h-10 w-10 items-center justify-center rounded-full text-[15px] tabular ${cls} disabled:active:scale-100`}>
                {parseKey(day).getDate()}
                {dot?.(day) && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-current" />}
              </button>
            </div>
          )
        })}
      </div>
      {footer?.({ start, end })}
    </div>
  )
}
