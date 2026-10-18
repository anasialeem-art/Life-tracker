import { CalculationMethod, Coordinates, HighLatitudeRule, Madhab, PrayerTimes, Qibla } from 'adhan'
import type { PrayerExtras, PrayerLog, PrayerName } from './db'
import { addDays, calendarKey, dayKeyAt, daysBetween, parseKey, weekdayOf, type DayKey } from './day'
import type { Settings } from './settings'

export const PRAYERS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']

export const METHODS: { key: Settings['prayerMethod']; label: string }[] = [
  { key: 'MuslimWorldLeague', label: 'Muslim World League' },
  { key: 'Egyptian', label: 'Egyptian General Authority' },
  { key: 'Karachi', label: 'University of Karachi' },
  { key: 'UmmAlQura', label: 'Umm al-Qura, Makkah' },
  { key: 'Dubai', label: 'Dubai' },
  { key: 'MoonsightingCommittee', label: 'Moonsighting Committee' },
  { key: 'NorthAmerica', label: 'ISNA (North America)' },
  { key: 'Kuwait', label: 'Kuwait' },
  { key: 'Qatar', label: 'Qatar' },
  { key: 'Singapore', label: 'Singapore' },
  { key: 'Tehran', label: 'Tehran' },
  { key: 'Turkey', label: 'Diyanet (Turkey)' },
]

export const HIGH_LAT_RULES: { key: Settings['highLatRule']; label: string }[] = [
  { key: 'auto', label: 'Automatic' },
  { key: 'middleofthenight', label: 'Middle of the night' },
  { key: 'seventhofthenight', label: 'One-seventh of the night' },
  { key: 'twilightangle', label: 'Twilight angle' },
]

export const SUNNAH_EXTRAS = [
  { key: 'sunnah-fajr', label: 'Fajr', detail: '2 before' },
  { key: 'sunnah-dhuhr', label: 'Dhuhr', detail: '4 + 2' },
  { key: 'sunnah-maghrib', label: 'Maghrib', detail: '2 after' },
  { key: 'sunnah-isha', label: 'Isha', detail: '2 after' },
  { key: 'witr', label: 'Witr', detail: 'night' },
]

export const ADHKAR_EXTRAS = [
  { key: 'adhkar-morning', label: 'Morning adhkar' },
  { key: 'adhkar-evening', label: 'Evening adhkar' },
]

export type PrayerConfig = Pick<Settings, 'prayerLocation' | 'prayerMethod' | 'asrMethod' | 'highLatRule'>

export function prayerLabel(p: PrayerName, day: DayKey): string {
  if (p === 'dhuhr' && weekdayOf(day) === 5) return 'Jumu’ah'
  return { fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha' }[p]
}

function params(cfg: PrayerConfig) {
  const p = CalculationMethod[cfg.prayerMethod]()
  p.madhab = cfg.asrMethod === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi
  if (cfg.prayerLocation) {
    const coords = new Coordinates(cfg.prayerLocation.lat, cfg.prayerLocation.lng)
    p.highLatitudeRule = cfg.highLatRule === 'auto' ? HighLatitudeRule.recommended(coords) : cfg.highLatRule
  }
  return p
}

export interface DayTimes { fajr: Date; sunrise: Date; dhuhr: Date; asr: Date; maghrib: Date; isha: Date }

const cache = new Map<string, DayTimes>()

/** Prayer times for a calendar date, or null without a location. */
export function timesFor(cfg: PrayerConfig, day: DayKey): DayTimes | null {
  const loc = cfg.prayerLocation
  if (!loc) return null
  const key = `${loc.lat},${loc.lng},${cfg.prayerMethod},${cfg.asrMethod},${cfg.highLatRule},${day}`
  let t = cache.get(key)
  if (!t) {
    const d = parseKey(day)
    const pt = new PrayerTimes(new Coordinates(loc.lat, loc.lng), new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12), params(cfg))
    t = { fajr: pt.fajr, sunrise: pt.sunrise, dhuhr: pt.dhuhr, asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha }
    if (cache.size > 500) cache.clear()
    cache.set(key, t)
  }
  return t
}

/** The prayer day a moment belongs to: switches at Fajr. Falls back to the 05:00 rule without a location. */
export function prayerDayAt(cfg: PrayerConfig, moment = new Date()): DayKey {
  const key = calendarKey(moment)
  const t = timesFor(cfg, key)
  if (!t) return dayKeyAt(moment)
  return moment < t.fajr ? addDays(key, -1) : key
}

export interface NextPrayer { prayer: PrayerName; day: DayKey; at: Date }

export function nextPrayer(cfg: PrayerConfig, now = new Date()): NextPrayer | null {
  const today = calendarKey(now)
  for (const day of [today, addDays(today, 1)]) {
    const t = timesFor(cfg, day)
    if (!t) return null
    for (const p of PRAYERS) if (t[p] > now) return { prayer: p, day, at: t[p] }
  }
  return null
}

export function qiblaBearing(cfg: PrayerConfig): number | null {
  const loc = cfg.prayerLocation
  return loc ? Qibla(new Coordinates(loc.lat, loc.lng)) : null
}

export const isPrayed = (l: PrayerLog | undefined) => l?.status === 'ontime' || l?.status === 'late'

export function logsByDay(logs: PrayerLog[]): Map<DayKey, Map<PrayerName, PrayerLog>> {
  const m = new Map<DayKey, Map<PrayerName, PrayerLog>>()
  for (const l of logs) {
    if (!m.has(l.day)) m.set(l.day, new Map())
    m.get(l.day)!.set(l.prayer, l)
  }
  return m
}

/**
 * Owed prayers. Every slot left unlogged once its prayer day has ended adds
 * one; a slot marked Qada was missed and made up, so it nets to zero. Logging
 * a forgotten prayer retroactively takes it back off.
 */
export function qadaCount(base: number, trackingStart: DayKey | null, logs: PrayerLog[], prayerToday: DayKey): number {
  if (!trackingStart || trackingStart >= prayerToday) return base
  const endedDays = daysBetween(trackingStart, prayerToday)
  const logged = logs.filter((l) => l.status && l.day >= trackingStart && l.day < prayerToday).length
  return Math.max(0, base + endedDays * PRAYERS.length - logged)
}

/** Ended days in range with any of the five not prayed on time or late. */
export function missedPrayerDays(logs: PrayerLog[], days: DayKey[], trackingStart: DayKey | null, prayerToday: DayKey): Set<DayKey> {
  const byDay = logsByDay(logs)
  const out = new Set<DayKey>()
  for (const day of days) {
    if (!trackingStart || day < trackingStart || day >= prayerToday) continue
    const m = byDay.get(day)
    if (!PRAYERS.every((p) => isPrayed(m?.get(p)))) out.add(day)
  }
  return out
}

/** Consecutive days with all five prayed (on time or late). Today counts once complete, but never breaks it. */
export function prayerStreak(logs: PrayerLog[], prayerToday: DayKey): number {
  const byDay = logsByDay(logs)
  const full = (day: DayKey) => PRAYERS.every((p) => isPrayed(byDay.get(day)?.get(p)))
  let streak = full(prayerToday) ? 1 : 0
  for (let day = addDays(prayerToday, -1); full(day); day = addDays(day, -1)) streak++
  return streak
}

export function extrasDone(extras: PrayerExtras | undefined, key: string): boolean {
  return !!extras?.done[key]
}

export const fmtTime = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })

/** "2h 14m" / "14m 05s" countdown. */
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  return `${m}m ${String(sec).padStart(2, '0')}s`
}
