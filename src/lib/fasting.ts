import type { Fast, FastType } from './db'
import { addDays, weekdayOf, type DayKey } from './day'
import { hijriOf } from './hijri'

export const FAST_TYPES: { value: FastType; label: string; color: string }[] = [
  { value: 'ramadan', label: 'Ramadan', color: 'var(--accent)' },
  { value: 'sunnah', label: 'Sunnah', color: 'var(--success)' },
  { value: 'qada', label: 'Qada', color: 'var(--warning)' },
  { value: 'other', label: 'Other', color: 'var(--muted)' },
]

export interface FastHint { key: string; label: string }

/** Days on which fasting is not allowed: both Eids and the days of Tashreeq. */
export function isForbiddenFastDay(day: DayKey, offset = 0): string | null {
  const h = hijriOf(day, offset)
  if (h.month === 10 && h.day === 1) return 'Eid al-Fitr'
  if (h.month === 12 && h.day === 10) return 'Eid al-Adha'
  if (h.month === 12 && h.day >= 11 && h.day <= 13) return 'Days of Tashreeq'
  return null
}

export const isRamadan = (day: DayKey, offset = 0) => hijriOf(day, offset).month === 9

/** Recommended (sunnah) fasts falling on a day. None during Ramadan or on forbidden days. */
export function sunnahHints(day: DayKey, offset = 0): FastHint[] {
  if (isRamadan(day, offset) || isForbiddenFastDay(day, offset)) return []
  const h = hijriOf(day, offset)
  const out: FastHint[] = []
  if (h.month === 12 && h.day === 9) out.push({ key: 'arafah', label: 'Day of Arafah' })
  if (h.month === 1 && h.day === 10) out.push({ key: 'ashura', label: 'Ashura' })
  if (h.month === 1 && h.day === 9) out.push({ key: 'tasua', label: 'Tasu‘a (day before Ashura)' })
  if (h.day >= 13 && h.day <= 15) out.push({ key: 'bid', label: `White days (${h.day}th)` })
  const wd = weekdayOf(day)
  if (wd === 1) out.push({ key: 'monday', label: 'Monday' })
  if (wd === 4) out.push({ key: 'thursday', label: 'Thursday' })
  return out
}

/** The next days (from `from`, inclusive) with a sunnah fast hint. */
export function upcomingHints(from: DayKey, count: number, offset = 0): { day: DayKey; hints: FastHint[] }[] {
  const out: { day: DayKey; hints: FastHint[] }[] = []
  for (let i = 0; i < 120 && out.length < count; i++) {
    const day = addDays(from, i)
    const hints = sunnahHints(day, offset)
    if (hints.length) out.push({ day, hints })
  }
  return out
}

/** Ended Ramadan days since tracking started that have no fast logged. */
export function missedRamadanDays(fasts: Fast[], trackingStart: DayKey | null, today: DayKey, offset = 0): DayKey[] {
  if (!trackingStart || trackingStart >= today) return []
  const fasted = new Set(fasts.map((f) => f.day))
  const out: DayKey[] = []
  for (let d = trackingStart; d < today; d = addDays(d, 1)) {
    if (isRamadan(d, offset) && !fasted.has(d)) out.push(d)
  }
  return out
}

/** Owed fasts: the manual base, plus missed Ramadan days, minus qada fasts made up. */
export function qadaFastCount(base: number, missed: number, fasts: Fast[]): number {
  return Math.max(0, base + missed - fasts.filter((f) => f.type === 'qada').length)
}
