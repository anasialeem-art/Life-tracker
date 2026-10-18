// Day logic shared by every tab.
//
// A "day key" is a local calendar date string, YYYY-MM-DD. The app's day runs
// 05:00 → 05:00, so 00:00–04:59 still belongs to the previous day key.
// All arithmetic goes through the Date(y, m, d) constructor so DST changes
// (23h / 25h days) never shift a key.

export type DayKey = string

export const ROLLOVER_HOUR = 5

const pad = (n: number) => String(n).padStart(2, '0')

/** Calendar date of a Date, ignoring rollover. */
export function calendarKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local midnight of a key. */
export function parseKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = parseKey(key)
  return calendarKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n))
}

/** The app day a moment belongs to, using the 05:00 rollover. */
export function dayKeyAt(moment: Date, rolloverHour = ROLLOVER_HOUR): DayKey {
  const key = calendarKey(moment)
  return moment.getHours() < rolloverHour ? addDays(key, -1) : key
}

export function todayKey(now = new Date()): DayKey {
  return dayKeyAt(now)
}

/** When an app day starts: that date at 05:00. */
export function dayStart(key: DayKey, rolloverHour = ROLLOVER_HOUR): Date {
  const d = parseKey(key)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), rolloverHour)
}

/** When an app day ends: the next date at 05:00. */
export function dayEnd(key: DayKey, rolloverHour = ROLLOVER_HOUR): Date {
  return dayStart(addDays(key, 1), rolloverHour)
}

/** A day only counts as missed once it has fully ended. */
export function hasDayEnded(key: DayKey, now = new Date()): boolean {
  return now.getTime() >= dayEnd(key).getTime()
}

export function isToday(key: DayKey, now = new Date()): boolean {
  return key === todayKey(now)
}

/** Future days are visible but locked. */
export function isFuture(key: DayKey, now = new Date()): boolean {
  return key > todayKey(now)
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: DayKey, b: DayKey): number {
  const pa = parseKey(a)
  const pb = parseKey(b)
  return Math.round((Date.UTC(pb.getFullYear(), pb.getMonth(), pb.getDate()) -
    Date.UTC(pa.getFullYear(), pa.getMonth(), pa.getDate())) / 86_400_000)
}

/** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
export function weekdayOf(key: DayKey): number {
  return parseKey(key).getDay()
}

// ---- Prayer day -----------------------------------------------------------
// The prayer day switches at Fajr instead of 05:00: until Fajr comes in, Isha
// still belongs to the previous date. `fajrOf` returns the Fajr moment for a
// calendar date (wired to adhan-js in the Prayer step).

export type FajrLookup = (calendarDate: DayKey) => Date

export function prayerDayKeyAt(moment: Date, fajrOf: FajrLookup): DayKey {
  const key = calendarKey(moment)
  return moment.getTime() < fajrOf(key).getTime() ? addDays(key, -1) : key
}

/** A prayer day ends when the next date's Fajr comes in. */
export function hasPrayerDayEnded(key: DayKey, fajrOf: FajrLookup, now = new Date()): boolean {
  return now.getTime() >= fajrOf(addDays(key, 1)).getTime()
}

// ---- Formatting -----------------------------------------------------------

const LOCALE = 'en-GB'

/** "Sunday" */
export function weekdayName(key: DayKey): string {
  return parseKey(key).toLocaleDateString(LOCALE, { weekday: 'long' })
}

/** "18 October 2026" (year omitted when it's the current year) */
export function longDate(key: DayKey, now = new Date()): string {
  const d = parseKey(key)
  const sameYear = d.getFullYear() === parseKey(todayKey(now)).getFullYear()
  return d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) })
}

/** "Today", "Yesterday", "Tomorrow" or null. */
export function relativeLabel(key: DayKey, now = new Date()): string | null {
  const diff = daysBetween(todayKey(now), key)
  return diff === 0 ? 'Today' : diff === -1 ? 'Yesterday' : diff === 1 ? 'Tomorrow' : null
}
