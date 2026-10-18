import type { CyclePhase, Med, MedLog, MedSchedule } from './db'
import { addDays, daysBetween, type DayKey } from './day'

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
  if (s.pattern === 'cycle') {
    const pos = cyclePosition(s.cycle ?? [], daysBetween(s.startDate, day))
    if (!pos || pos.phase.mode === 'off') return 0
    if (pos.phase.mode === 'alternate' && pos.dayInPhase % 2 !== 0) return 0
  }
  return s.dosesPerDay
}

// ---- Cycles -------------------------------------------------------------------

export const phaseDays = (p: CyclePhase) => p.length * (p.unit === 'weeks' ? 7 : 1)
export const cycleDays = (phases: CyclePhase[]) => phases.reduce((n, p) => n + phaseDays(p), 0)

export interface CyclePosition {
  /** Which repetition of the cycle (0-based). */
  round: number
  phaseIndex: number
  phase: CyclePhase
  /** Day within the current phase (0-based); every-other-day phases dose on even days. */
  dayInPhase: number
  /** Day within the whole cycle (0-based). */
  dayInCycle: number
}

/** Where `offset` days after the start falls in a repeating cycle. */
export function cyclePosition(phases: CyclePhase[], offset: number): CyclePosition | null {
  const total = cycleDays(phases)
  if (offset < 0 || total <= 0) return null
  const dayInCycle = offset % total
  let rest = dayInCycle
  for (let i = 0; i < phases.length; i++) {
    const len = phaseDays(phases[i])
    if (rest < len) return { round: Math.floor(offset / total), phaseIndex: i, phase: phases[i], dayInPhase: rest, dayInCycle }
    rest -= len
  }
  return null
}

/** The next day on or after `from` with a dose due, within a year. */
export function nextDoseDay(med: Med, from: DayKey): DayKey | null {
  for (let i = 0; i < 366; i++) {
    const d = addDays(from, i)
    if (dosesDue(med, d) > 0) return d
  }
  return null
}

const MODE_LABEL: Record<CyclePhase['mode'], string> = { daily: 'daily', alternate: 'every other day', off: 'break' }

export function describePhase(p: CyclePhase): string {
  const unit = p.unit === 'weeks' ? (p.length === 1 ? 'week' : 'weeks') : p.length === 1 ? 'day' : 'days'
  return `${p.length} ${unit} ${MODE_LABEL[p.mode]}`
}

/** "Week 2 of 6 · every other day" for a cycle med on a given day. */
export function describeCycleDay(s: MedSchedule, day: DayKey): string | null {
  if (s.pattern !== 'cycle' || !s.cycle?.length) return null
  const pos = cyclePosition(s.cycle, daysBetween(s.startDate, day))
  if (!pos) return null
  const total = cycleDays(s.cycle)
  const where = total % 7 === 0 ? `Week ${Math.floor(pos.dayInCycle / 7) + 1} of ${total / 7}` : `Day ${pos.dayInCycle + 1} of ${total}`
  return `${where} · ${MODE_LABEL[pos.phase.mode]}`
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
  const doses = `${s.dosesPerDay} ${s.dosesPerDay === 1 ? 'dose' : 'doses'}`
  if (s.pattern === 'cycle') return `Cycle · ${describeCycleDay(s, day) ?? ''}${s.dosesPerDay > 1 ? ` · ${doses}` : ''}`
  const pattern = s.pattern === 'daily' ? 'Daily' : s.pattern === 'alternate' ? 'Every other day' : 'Selected days'
  return `${pattern} · ${doses}`
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
    a.endDate === b.endDate && a.customDays.join() === b.customDays.join() &&
    JSON.stringify(a.cycle ?? null) === JSON.stringify(b.cycle ?? null)
}
