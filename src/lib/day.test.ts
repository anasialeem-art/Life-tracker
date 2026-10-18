import { describe, expect, it } from 'vitest'
import {
  addDays, dayEnd, dayKeyAt, daysBetween, hasDayEnded, hasPrayerDayEnded, isFuture,
  prayerDayKeyAt, relativeLabel, todayKey, weekdayOf, type FajrLookup,
} from './day'

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min)

describe('05:00 rollover', () => {
  it('treats 00:00–04:59 as the previous day', () => {
    expect(dayKeyAt(at(2026, 10, 18, 0, 0))).toBe('2026-10-17')
    expect(dayKeyAt(at(2026, 10, 18, 4, 59))).toBe('2026-10-17')
    expect(dayKeyAt(at(2026, 10, 18, 5, 0))).toBe('2026-10-18')
    expect(dayKeyAt(at(2026, 10, 18, 23, 59))).toBe('2026-10-18')
  })

  it('rolls back across month and year boundaries', () => {
    expect(dayKeyAt(at(2026, 3, 1, 2))).toBe('2026-02-28')
    expect(dayKeyAt(at(2027, 1, 1, 3))).toBe('2026-12-31')
  })

  it('only marks a day ended at 05:00 the next morning', () => {
    expect(hasDayEnded('2026-10-17', at(2026, 10, 18, 4, 59))).toBe(false)
    expect(hasDayEnded('2026-10-17', at(2026, 10, 18, 5, 0))).toBe(true)
    expect(dayEnd('2026-10-17').getTime()).toBe(at(2026, 10, 18, 5).getTime())
  })

  it('locks future days relative to the app day', () => {
    const lateNight = at(2026, 10, 19, 1) // still the 18th
    expect(todayKey(lateNight)).toBe('2026-10-18')
    expect(isFuture('2026-10-19', lateNight)).toBe(true)
    expect(isFuture('2026-10-18', lateNight)).toBe(false)
    expect(relativeLabel('2026-10-17', lateNight)).toBe('Yesterday')
  })
})

describe('date arithmetic', () => {
  it('survives DST changes (Europe: last Sunday of March / October)', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29')
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
    expect(daysBetween('2026-10-01', '2026-11-01')).toBe(31)
  })

  it('gives weekdays matching Date#getDay', () => {
    expect(weekdayOf('2026-10-18')).toBe(0) // Sunday
    expect(weekdayOf('2026-10-23')).toBe(5) // Friday
  })
})

describe('prayer day (switches at Fajr)', () => {
  const fajr: FajrLookup = (key) => {
    const [y, m, d] = key.split('-').map(Number)
    return new Date(y, m - 1, d, 6, 10) // fixed 06:10 for the test
  }

  it('keeps Isha on the previous day until Fajr', () => {
    expect(prayerDayKeyAt(at(2026, 10, 18, 5, 30), fajr)).toBe('2026-10-17')
    expect(prayerDayKeyAt(at(2026, 10, 18, 6, 9), fajr)).toBe('2026-10-17')
    expect(prayerDayKeyAt(at(2026, 10, 18, 6, 10), fajr)).toBe('2026-10-18')
    expect(prayerDayKeyAt(at(2026, 10, 18, 23, 0), fajr)).toBe('2026-10-18')
  })

  it('ends a prayer day when the next Fajr comes in', () => {
    expect(hasPrayerDayEnded('2026-10-17', fajr, at(2026, 10, 18, 6, 9))).toBe(false)
    expect(hasPrayerDayEnded('2026-10-17', fajr, at(2026, 10, 18, 6, 10))).toBe(true)
  })
})
