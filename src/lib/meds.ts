import type { Med, MedLog, MedSchedule } from './db'
import { daysBetween, type DayKey } from './day'

/** The schedule version in force on a day (the latest one effective on or before it). */
export function scheduleOn(med: Med, day: DayKey): MedSchedule | null {
  if (!med.schedules.length) return null
  let current = med.schedules[0]
  for (const s of med.schedules) if (s.effectiveFrom <= day) current = s
  return current
}

export function isVisibleOn(med: Med, day: DayKey): boolean {
  return !med.archivedFrom || day < med.archivedFrom
}

/** Number of dose slots due on a day (0 when not due). As-needed meds are never due. */
export function dosesDue(med: Med, day: DayKey): number {
  if (med.kind !== 'scheduled' || !isVisibleOn(med, day)) return 0
  const s = scheduleOn(med, day)
  if (!s) return 0
  if (s.pattern === 'custom') return s.customDays.includes(day) ? s.dosesPerDay : 0
  if (day < s.startDate) return 0
  if (s.endDate && day > s.endDate) return 0
  if (s.pattern === 'alternate' && daysBetween(s.startDate, day) % 2 !== 0) return 0
  return s.dosesPerDay
}

/** Days with at least one due scheduled slot left unchecked. */
export function missedDays(meds: Med[], logs: MedLog[], days: DayKey[]): Set<DayKey> {
  const taken = new Set(logs.filter((l) => l.slot >= 0).map((l) => `${l.medId}|${l.day}|${l.slot}`))
  const out = new Set<DayKey>()
  for (const day of days) {
    for (const med of meds) {
      const n = dosesDue(med, day)
      for (let slot = 0; slot < n; slot++) {
        if (!taken.has(`${med.id}|${day}|${slot}`)) {
          out.add(day)
          break
        }
      }
      if (out.has(day)) break
    }
  }
  return out
}

export interface DayDoseSummary { due: number; taken: number; remaining: { name: string; slots: number[] }[] }

export function summarizeDay(meds: Med[], logs: MedLog[], day: DayKey): DayDoseSummary {
  const taken = new Set(logs.filter((l) => l.day === day && l.slot >= 0).map((l) => `${l.medId}|${l.slot}`))
  let due = 0
  let done = 0
  const remaining: DayDoseSummary['remaining'] = []
  for (const med of meds) {
    const n = dosesDue(med, day)
    const left: number[] = []
    for (let slot = 0; slot < n; slot++) {
      due++
      if (taken.has(`${med.id}|${slot}`)) done++
      else left.push(slot)
    }
    if (left.length) remaining.push({ name: med.name, slots: left })
  }
  return { due, taken: done, remaining }
}

/** Short human description of a schedule, e.g. "Daily · 2 doses". */
export function describeSchedule(med: Med, day: DayKey): string {
  if (med.kind === 'asneeded') return 'As needed'
  const s = scheduleOn(med, day)
  if (!s) return ''
  const pattern = s.pattern === 'daily' ? 'Daily' : s.pattern === 'alternate' ? 'Every other day' : 'Selected days'
  return `${pattern} · ${s.dosesPerDay} ${s.dosesPerDay === 1 ? 'dose' : 'doses'}`
}

/**
 * Applies an edited schedule from `today` on: replaces a version that already
 * starts today, otherwise appends one, so earlier days keep their rules.
 */
export function withScheduleFrom(med: Med, next: Omit<MedSchedule, 'effectiveFrom'>, today: DayKey): MedSchedule[] {
  const kept = med.schedules.filter((s) => s.effectiveFrom < today)
  const prev = kept.at(-1)
  if (prev && sameSchedule(prev, next)) return kept
  return [...kept, { ...next, effectiveFrom: kept.length ? today : '0000-01-01' }]
}

function sameSchedule(a: Omit<MedSchedule, 'effectiveFrom'>, b: Omit<MedSchedule, 'effectiveFrom'>) {
  return a.pattern === b.pattern && a.dosesPerDay === b.dosesPerDay && a.startDate === b.startDate &&
    a.endDate === b.endDate && a.customDays.join() === b.customDays.join()
}
