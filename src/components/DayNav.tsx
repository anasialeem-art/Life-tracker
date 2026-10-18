import { addDays, isFuture, longDate, relativeLabel, weekdayName, type DayKey } from '../lib/day'
import { ChevronLeft, ChevronRight, LockIcon } from './Icons'

interface DayNavProps {
  day: DayKey
  today: DayKey
  onChange: (day: DayKey) => void
}

/**
 * Weekday + date with ◀ ▶ arrows. Tapping the date jumps back to today.
 * Future days are reachable but the caller should lock interaction (see `isFuture`).
 */
export function DayNav({ day, today, onChange }: DayNavProps) {
  const rel = relativeLabel(day)
  const future = isFuture(day)
  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface px-1 py-1">
      <button type="button" aria-label="Previous day" onClick={() => onChange(addDays(day, -1))}
        className="pressable flex h-12 w-12 items-center justify-center rounded-xl text-accent">
        <ChevronLeft />
      </button>
      <button type="button" onClick={() => onChange(today)} aria-label="Jump to today"
        className="pressable flex min-w-0 flex-1 flex-col items-center rounded-xl py-1">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold">
          {weekdayName(day)}
          {future && <LockIcon size={14} className="text-muted" />}
        </span>
        <span className="text-[13px] text-muted">
          {longDate(day)}
          {rel && <span className={day === today ? 'text-accent' : ''}> · {rel}</span>}
        </span>
      </button>
      <button type="button" aria-label="Next day" onClick={() => onChange(addDays(day, 1))}
        className="pressable flex h-12 w-12 items-center justify-center rounded-xl text-accent">
        <ChevronRight />
      </button>
    </div>
  )
}
