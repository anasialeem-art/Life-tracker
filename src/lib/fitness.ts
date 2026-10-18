import type { LyftaSet, SplitDay, TrainingDay } from './db'
import { addDays, calendarKey, daysBetween, parseKey, weekdayOf, type DayKey } from './day'
import type { CycleAnchor, Settings } from './settings'

export type SplitConfig = Pick<Settings, 'splitMode' | 'weekdayPlan' | 'cycleAnchors'>

/** The anchor in force on a day: the latest one on or before it, else the earliest. */
function anchorOn(anchors: CycleAnchor[], day: DayKey): CycleAnchor | null {
  if (!anchors.length) return null
  const sorted = [...anchors].sort((a, b) => (a.day < b.day ? -1 : 1))
  let current = sorted[0]
  for (const a of sorted) if (a.day <= day) current = a
  return current
}

const mod = (n: number, m: number) => ((n % m) + m) % m

/** The planned split day for a date, before any one-off swap. */
export function plannedSplit(cfg: SplitConfig, splits: SplitDay[], day: DayKey): SplitDay | null {
  if (!splits.length) return null
  if (cfg.splitMode === 'weekday') {
    const id = cfg.weekdayPlan[String(weekdayOf(day))]
    return splits.find((s) => s.id === id) ?? null
  }
  const ordered = [...splits].sort((a, b) => a.order - b.order)
  // Fixed fallback so the rotation still advances before a start date is chosen.
  const anchor = anchorOn(cfg.cycleAnchors, day) ?? { day: '2000-01-03', index: 0 }
  return ordered[mod(anchor.index + daysBetween(anchor.day, day), ordered.length)]
}

/** What's on for a day: a logged swap (weekday mode) wins over the plan. */
export function splitFor(cfg: SplitConfig, splits: SplitDay[], day: DayKey, log: TrainingDay | undefined): SplitDay | null {
  if (cfg.splitMode === 'weekday' && log?.splitDayId) {
    const swapped = splits.find((s) => s.id === log.splitDayId)
    if (swapped) return swapped
  }
  return plannedSplit(cfg, splits, day)
}

/**
 * Cycle mode "change today": restarts the rotation from the chosen step on `day`.
 * Replaces an anchor already set for that day; earlier anchors keep past days stable.
 */
export function anchorsAfterReset(anchors: CycleAnchor[], day: DayKey, index: number): CycleAnchor[] {
  return [...anchors.filter((a) => a.day !== day), { day, index }]
}

/**
 * Consecutive days, counting back from today, that were trained or were a
 * planned rest day. An untrained today doesn't break the streak yet.
 */
export function trainingStreak(cfg: SplitConfig, splits: SplitDay[], logs: TrainingDay[], today: DayKey): number {
  const byDay = new Map(logs.map((l) => [l.day, l]))
  const firstTrained = logs.filter((l) => l.trained).map((l) => l.day).sort()[0]
  if (!firstTrained) return 0
  const counts = (day: DayKey) => byDay.get(day)?.trained || !!splitFor(cfg, splits, day, byDay.get(day))?.rest
  let streak = byDay.get(today)?.trained ? 1 : 0
  for (let day = addDays(today, -1); day >= firstTrained && counts(day); day = addDays(day, -1)) {
    if (byDay.get(day)?.trained) streak++
  }
  return streak
}

// ---- Lyfta CSV ------------------------------------------------------------------

/** RFC 4180-ish CSV parser (quotes, escaped quotes, CRLF, ; or , delimiters). */
export function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf('\n') >>> 0)
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === delim) { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f.trim())) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f.trim())) rows.push(row)
  return rows
}

function parseDay(raw: string): DayKey | null {
  const s = raw.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return calendarKey(new Date(+m[1], +m[2] - 1, +m[3]))
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  if (m) return calendarKey(new Date(+m[3], +m[2] - 1, +m[1]))
  const t = Date.parse(s)
  return Number.isNaN(t) ? null : calendarKey(new Date(t))
}

const num = (s: string | undefined) => {
  const n = parseFloat((s ?? '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : NaN
}

/** Extracts sets from a Lyfta export, finding columns by header name. */
export function parseLyftaCsv(text: string): Omit<LyftaSet, 'id'>[] {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('The file has no rows.')
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const find = (...patterns: RegExp[]) => {
    for (const p of patterns) {
      const i = header.findIndex((h) => p.test(h))
      if (i >= 0) return i
    }
    return -1
  }
  const iDate = find(/^date$/, /date/, /time/)
  const iEx = find(/^exercise$/, /exercise/, /^name$/)
  const iWeight = find(/^weight/, /weight/, /\bkg\b/, /lbs?/)
  const iReps = find(/^reps$/, /reps?/)
  if (iDate < 0 || iEx < 0 || iWeight < 0 || iReps < 0) {
    throw new Error('Couldn’t find date, exercise, weight and reps columns in this CSV.')
  }
  const out: Omit<LyftaSet, 'id'>[] = []
  for (const r of rows.slice(1)) {
    const day = parseDay(r[iDate] ?? '')
    const exercise = (r[iEx] ?? '').trim()
    const weight = num(r[iWeight])
    const reps = num(r[iReps])
    if (!day || !exercise || !Number.isFinite(reps) || reps <= 0) continue
    out.push({ day, exercise, weight: Number.isFinite(weight) ? weight : 0, reps })
  }
  if (!out.length) throw new Error('No sets found in this CSV.')
  return out
}

/** Monday of the week containing a day. */
export function weekStart(day: DayKey): DayKey {
  return addDays(day, -mod(weekdayOf(day) - 1, 7))
}

export function weeklyVolume(sets: LyftaSet[], weeks: number, today: DayKey): { week: DayKey; volume: number }[] {
  const thisWeek = weekStart(today)
  const out = Array.from({ length: weeks }, (_, i) => ({ week: addDays(thisWeek, -7 * (weeks - 1 - i)), volume: 0 }))
  const index = new Map(out.map((w, i) => [w.week, i]))
  for (const s of sets) {
    const i = index.get(weekStart(s.day))
    if (i !== undefined) out[i].volume += s.weight * s.reps
  }
  return out
}

export interface ExercisePR { exercise: string; weight: number; reps: number; day: DayKey; e1rm: number }

/** Heaviest set per exercise, with an Epley one-rep-max estimate. */
export function personalRecords(sets: LyftaSet[]): ExercisePR[] {
  const best = new Map<string, ExercisePR>()
  for (const s of sets) {
    const e1rm = s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30)
    const cur = best.get(s.exercise)
    if (!cur || s.weight > cur.weight || (s.weight === cur.weight && s.reps > cur.reps)) {
      best.set(s.exercise, { exercise: s.exercise, weight: s.weight, reps: s.reps, day: s.day, e1rm: Math.max(e1rm, cur?.e1rm ?? 0) })
    } else if (e1rm > cur.e1rm) cur.e1rm = e1rm
  }
  return [...best.values()].sort((a, b) => b.e1rm - a.e1rm)
}

export const shortDate = (day: DayKey) => parseKey(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
