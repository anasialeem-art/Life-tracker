import { addDays, calendarKey, parseKey, type DayKey } from './day'

// Offline Hijri dates. Uses the browser's built-in Umm al-Qura calendar (ICU),
// falling back to the arithmetic (tabular) Islamic calendar if unavailable.
// `offset` shifts the result by whole days to match local moon sighting.

export interface HijriDate { year: number; month: number; day: number }

export const HIJRI_MONTHS = [
  'Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi al-Thani', 'Jumada al-Ula', 'Jumada al-Akhirah',
  'Rajab', 'Sha‘ban', 'Ramadan', 'Shawwal', 'Dhu al-Qa‘dah', 'Dhu al-Hijjah',
]

let fmt: Intl.DateTimeFormat | null | undefined

function intlFormatter(): Intl.DateTimeFormat | null {
  if (fmt !== undefined) return fmt
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' })
    fmt = f.resolvedOptions().calendar === 'islamic-umalqura' ? f : null
  } catch {
    fmt = null
  }
  return fmt
}

/** Arithmetic Islamic calendar (civil epoch), via the Julian day number. */
export function tabularHijri(day: DayKey): HijriDate {
  const d = parseKey(day)
  const y = d.getFullYear(), m = d.getMonth() + 1, dd = d.getDate()
  const a = Math.floor((14 - m) / 12)
  const yy = y + 4800 - a
  const mm = m + 12 * a - 3
  const jd = dd + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045
  const l0 = jd - 1948440 + 10632
  const n = Math.floor((l0 - 1) / 10631)
  const l1 = l0 - 10631 * n + 354
  const j = Math.floor((10985 - l1) / 5316) * Math.floor((50 * l1) / 17719) + Math.floor(l1 / 5670) * Math.floor((43 * l1) / 15238)
  const l2 = l1 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29
  const month = Math.floor((24 * l2) / 709)
  return { year: 30 * n + j - 30, month, day: l2 - Math.floor((709 * month) / 24) }
}

const cache = new Map<string, HijriDate>()

export function hijriOf(day: DayKey, offset = 0): HijriDate {
  const key = `${day}|${offset}`
  const hit = cache.get(key)
  if (hit) return hit
  const shifted = offset ? addDays(day, offset) : day
  const f = intlFormatter()
  let h: HijriDate
  if (f) {
    const parts = f.formatToParts(new Date(`${shifted}T12:00:00Z`))
    const num = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '', 10)
    h = { year: num('year'), month: num('month'), day: num('day') }
    if (!h.year || !h.month || !h.day) h = tabularHijri(shifted)
  } else h = tabularHijri(shifted)
  if (cache.size > 5000) cache.clear()
  cache.set(key, h)
  return h
}

export function formatHijri(h: HijriDate): string {
  return `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year}`
}

/** Gregorian days of a Hijri month (e.g. all of Ramadan 1448). */
export function hijriMonthDays(year: number, month: number, offset = 0): DayKey[] {
  // Rough start from the tabular calendar's average month length, then scan around it.
  const monthsSinceEpoch = (year - 1) * 12 + (month - 1)
  const approx = new Date(Date.UTC(622, 6, 16) + monthsSinceEpoch * 29.530588 * 86_400_000)
  const start = calendarKey(new Date(approx.getUTCFullYear(), approx.getUTCMonth(), approx.getUTCDate()))
  const out: DayKey[] = []
  for (let i = -20; i < 50; i++) {
    const d = addDays(start, i)
    const h = hijriOf(d, offset)
    if (h.year === year && h.month === month) out.push(d)
  }
  return out
}
