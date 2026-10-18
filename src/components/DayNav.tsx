import { addDays, daysBetween, longDate, weekdayName, type DayKey } from '../lib/day'
import { ChevronLeft, ChevronRight, LockIcon } from './Icons'

interface DayNavProps {
  day: DayKey
  today: DayKey
  onChange: (day: DayKey) => void
}

/**
 * Weekday + date with ◀ ▶ arrows. Tapping the date jumps back to today.
 * Future days are reachable but the caller should lock interaction (see `isFuture`).
 * `today` is passed in so the Prayer tab can use its Fajr-based day.
 */
export function DayNav({ day, today, onChange }: DayNavProps) {
  const diff = daysBetween(today, day)
  const rel = diff === 0 ? 'Today' : diff === -1 ? 'Yesterday' : diff === 1 ? 'Tomorrow' : null
  const future = day > today
  const label = rel ?? weekdayName(day)
  return (
    <div className="flex items-center justify-between rounded-[22px] bg-surface p-1 shadow-card">
      <button type="button" aria-label="Previous day" onClick={() => onChange(addDays(day, -1))}
        className="pressable flex h-12 w-12 items-center justify-center rounded-[18px] text-accent active:bg-surface-2">
        <ChevronLeft />
      </button>
      <button type="button" onClick={() => onChange(today)} aria-label="Jump to today"
        className="pressable flex min-w-0 flex-1 flex-col items-center rounded-xl py-0.5">
        <span className="flex items-center gap-1.5 text-[16px] font-semibold">
          {label}
          {future && <LockIcon size={14} className="text-muted" />}
        </span>
        <span className="text-[13px] text-muted">
          {rel ? `${weekdayName(day)}, ${longDate(day)}` : longDate(day)}
        </span>
      </button>
      <button type="button" aria-label="Next day" onClick={() => onChange(addDays(day, 1))}
        className="pressable flex h-12 w-12 items-center justify-center rounded-[18px] text-accent active:bg-surface-2">
        <ChevronRight />
      </button>
    </div>
  )
}

/** Banner shown on future days. */
export function FutureNotice() {
  return (
    <div className="animate-fade-in flex items-center justify-center gap-2 rounded-2xl bg-surface-2 px-4 py-2.5 text-[14px] font-medium text-muted">
      <LockIcon size={16} /> Future day — view only
    </div>
  )
}
