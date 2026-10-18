import { describe, expect, it } from 'vitest'
import type { Med, MedLog, PrayerLog, SplitDay, TrainingDay } from './db'
import { anchorsAfterReset, parseLyftaCsv, personalRecords, plannedSplit, splitFor, trainingStreak, weeklyVolume } from './fitness'
import { dosesDue, missedDays, summarizeDay, withScheduleFrom } from './meds'
import { missedPrayerDays, prayerDayAt, prayerStreak, qadaCount, timesFor, type PrayerConfig } from './prayer'
import { isOverdue, nextOccurrence } from './todo'

const med = (over: Partial<Med> = {}): Med => ({
  id: 'm1', name: 'Ibuprofen', kind: 'scheduled', archivedFrom: null, order: 0, createdAt: 0,
  schedules: [{ effectiveFrom: '0000-01-01', pattern: 'daily', customDays: [], dosesPerDay: 2, startDate: '2026-10-01', endDate: null }],
  ...over,
})

describe('meds', () => {
  it('respects start, end, alternate days and custom days', () => {
    const m = med()
    expect(dosesDue(m, '2026-09-30')).toBe(0)
    expect(dosesDue(m, '2026-10-01')).toBe(2)
    const alt = med({ schedules: [{ ...m.schedules[0], pattern: 'alternate', endDate: '2026-10-10' }] })
    expect([1, 2, 3, 4].map((d) => dosesDue(alt, `2026-10-0${d}`))).toEqual([2, 0, 2, 0])
    expect(dosesDue(alt, '2026-10-11')).toBe(0)
    const custom = med({ schedules: [{ ...m.schedules[0], pattern: 'custom', customDays: ['2026-10-05'] }] })
    expect(dosesDue(custom, '2026-10-05')).toBe(2)
    expect(dosesDue(custom, '2026-10-06')).toBe(0)
  })

  it('applies schedule edits only from today on', () => {
    const m = med()
    const schedules = withScheduleFrom(m, { ...m.schedules[0], dosesPerDay: 3 }, '2026-10-15')
    const edited = { ...m, schedules }
    expect(dosesDue(edited, '2026-10-14')).toBe(2)
    expect(dosesDue(edited, '2026-10-15')).toBe(3)
  })

  it('hides archived meds from the archive day on, keeping history', () => {
    const m = med({ archivedFrom: '2026-10-10' })
    expect(dosesDue(m, '2026-10-09')).toBe(2)
    expect(dosesDue(m, '2026-10-10')).toBe(0)
  })

  it('flags days with any unchecked scheduled slot; ignores as-needed', () => {
    const logs: MedLog[] = [
      { id: 'a', medId: 'm1', day: '2026-10-02', slot: 0, at: 0 },
      { id: 'b', medId: 'm1', day: '2026-10-02', slot: 1, at: 0 },
      { id: 'c', medId: 'm1', day: '2026-10-03', slot: 0, at: 0 },
    ]
    const asNeeded = med({ id: 'm2', kind: 'asneeded' })
    expect([...missedDays([med(), asNeeded], logs, ['2026-10-02', '2026-10-03'])]).toEqual(['2026-10-03'])
    expect(summarizeDay([med()], logs, '2026-10-03')).toMatchObject({ due: 2, taken: 1, remaining: [{ name: 'Ibuprofen', slots: [1] }] })
  })
})

describe('prayer', () => {
  const cfg: PrayerConfig = { prayerLocation: { name: 'Berlin', lat: 52.52, lng: 13.405 }, prayerMethod: 'MuslimWorldLeague', asrMethod: 'shafi', highLatRule: 'auto' }

  it('computes ordered times and switches the prayer day at Fajr', () => {
    const t = timesFor(cfg, '2026-10-18')!
    expect(t.fajr < t.sunrise && t.sunrise < t.dhuhr && t.dhuhr < t.asr && t.asr < t.maghrib && t.maghrib < t.isha).toBe(true)
    const beforeFajr = new Date(t.fajr.getTime() - 60_000)
    expect(prayerDayAt(cfg, beforeFajr)).toBe('2026-10-17')
    expect(prayerDayAt(cfg, t.fajr)).toBe('2026-10-18')
  })

  it('computes times in a German summer (high latitude)', () => {
    const t = timesFor({ ...cfg, prayerLocation: { name: 'Hamburg', lat: 53.55, lng: 9.99 } }, '2026-06-21')!
    expect(t.isha.getTime()).toBeGreaterThan(t.maghrib.getTime())
    expect(t.fajr.getTime()).toBeLessThan(t.sunrise.getTime())
  })

  const log = (day: string, prayer: PrayerLog['prayer'], status: PrayerLog['status']): PrayerLog => ({ id: `${day}|${prayer}`, day, prayer, status, jamaah: false })
  const fullDay = (day: string) => (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((p) => log(day, p, 'ontime'))

  it('adds unlogged ended prayers to qada; qada-marked nets to zero', () => {
    const logs = [...fullDay('2026-10-16'), ...fullDay('2026-10-17').slice(0, 3), log('2026-10-17', 'maghrib', 'qada')]
    // 16th complete, 17th: isha unlogged (+1), maghrib qada (0); today not ended.
    expect(qadaCount(10, '2026-10-16', logs, '2026-10-18')).toBe(11)
    expect([...missedPrayerDays(logs, ['2026-10-16', '2026-10-17', '2026-10-18'], '2026-10-16', '2026-10-18')]).toEqual(['2026-10-17'])
  })

  it('counts the streak of full days', () => {
    const logs = [...fullDay('2026-10-15'), ...fullDay('2026-10-16'), ...fullDay('2026-10-17')]
    expect(prayerStreak(logs, '2026-10-18')).toBe(3)
    expect(prayerStreak([...logs, ...fullDay('2026-10-18')], '2026-10-18')).toBe(4)
  })
})

describe('to-do recurrence', () => {
  it('steps daily, weekdays and monthly, skipping missed occurrences', () => {
    expect(nextOccurrence('2026-10-18', { type: 'daily' }, '2026-10-18')).toBe('2026-10-19')
    expect(nextOccurrence('2026-10-10', { type: 'daily' }, '2026-10-18')).toBe('2026-10-18')
    expect(nextOccurrence('2026-10-19', { type: 'weekdays', days: [1, 4] }, '2026-10-18')).toBe('2026-10-22')
    expect(nextOccurrence('2026-01-31', { type: 'monthly' }, '2026-01-31')).toBe('2026-02-28')
  })

  it('marks overdue by date, or by time on the due day', () => {
    expect(isOverdue({ due: '2026-10-17', time: null, done: false }, '2026-10-18')).toBe(true)
    expect(isOverdue({ due: '2026-10-18', time: '09:00', done: false }, '2026-10-18', new Date(2026, 9, 18, 10))).toBe(true)
    expect(isOverdue({ due: '2026-10-18', time: '11:00', done: false }, '2026-10-18', new Date(2026, 9, 18, 10))).toBe(false)
  })
})

describe('fitness', () => {
  const splits: SplitDay[] = ['Push', 'Pull', 'Legs', 'Rest'].map((name, order) => ({ id: name, name, order, rest: name === 'Rest', exercises: [] }))

  it('weekday mode uses the plan, with one-off swaps from the log', () => {
    const cfg = { splitMode: 'weekday' as const, weekdayPlan: { '1': 'Legs' }, cycleAnchors: [] }
    expect(plannedSplit(cfg, splits, '2026-10-19')?.name).toBe('Legs') // Monday
    expect(splitFor(cfg, splits, '2026-10-19', { day: '2026-10-19', splitDayId: 'Push', trained: false })?.name).toBe('Push')
  })

  it('cycle mode rotates daily and restarts from a reset without changing the past', () => {
    let anchors = [{ day: '2026-10-01', index: 0 }]
    const cfg = () => ({ splitMode: 'cycle' as const, weekdayPlan: {}, cycleAnchors: anchors })
    expect(plannedSplit(cfg(), splits, '2026-10-03')?.name).toBe('Legs')
    expect(plannedSplit(cfg(), splits, '2026-10-05')?.name).toBe('Push')
    anchors = anchorsAfterReset(anchors, '2026-10-05', 2)
    expect(plannedSplit(cfg(), splits, '2026-10-05')?.name).toBe('Legs')
    expect(plannedSplit(cfg(), splits, '2026-10-06')?.name).toBe('Rest')
    expect(plannedSplit(cfg(), splits, '2026-10-03')?.name).toBe('Legs')
  })

  it('streak counts trained days and bridges planned rest days', () => {
    const cfg = { splitMode: 'cycle' as const, weekdayPlan: {}, cycleAnchors: [{ day: '2026-10-01', index: 0 }] }
    const logs: TrainingDay[] = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05'].map((day) => ({ day, splitDayId: null, trained: true }))
    // 10-04 is Rest in the cycle, 10-06 (today) not trained yet
    expect(trainingStreak(cfg, splits, logs, '2026-10-06')).toBe(4)
  })

  it('parses a Lyfta-style CSV and computes stats', () => {
    const csv = 'Date,Workout,Exercise,Weight,Reps\n2026-10-12 18:00,Push,"Bench Press",80,5\n2026-10-12 18:05,Push,Bench Press,85,3\n2026-10-14,Pull,Row,60,10\n'
    const sets = parseLyftaCsv(csv).map((s, i) => ({ ...s, id: String(i) }))
    expect(sets).toHaveLength(3)
    expect(personalRecords(sets)[0]).toMatchObject({ exercise: 'Bench Press', weight: 85, reps: 3 })
    const vol = weeklyVolume(sets, 2, '2026-10-18')
    expect(vol.at(-1)).toEqual({ week: '2026-10-12', volume: 80 * 5 + 85 * 3 + 600 })
  })
})
