import type { ImportantDate } from './db'
import { calendarKey, daysBetween, parseKey, type DayKey } from './day'

// Yearly important dates (birthdays, anniversaries).

/** Next occurrence on or after today. 29 Feb falls on 28 Feb in non-leap years. */
export function nextOccurrence(d: Pick<ImportantDate, 'month' | 'day'>, today: DayKey): DayKey {
  const t = parseKey(today)
  for (const y of [t.getFullYear(), t.getFullYear() + 1]) {
    const last = new Date(y, d.month, 0).getDate()
    const key = calendarKey(new Date(y, d.month - 1, Math.min(d.day, last)))
    if (key >= today) return key
  }
  return today
}

export const daysUntil = (d: Pick<ImportantDate, 'month' | 'day'>, today: DayKey) => daysBetween(today, nextOccurrence(d, today))

/** Age / years being marked at the next occurrence, if the year is known. */
export function yearsAt(d: ImportantDate, today: DayKey): number | null {
  return d.year ? parseKey(nextOccurrence(d, today)).getFullYear() - d.year : null
}
