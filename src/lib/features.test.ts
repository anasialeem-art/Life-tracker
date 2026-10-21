import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Fast } from './db'
import { isForbiddenFastDay, missedRamadanDays, qadaFastCount, sunnahHints } from './fasting'
import { hijriMonthDays, hijriOf, tabularHijri } from './hijri'
import { arabicNumber, juzOfPage, khatmaPages, nextUnreadPage, pageAyat, pageOf, parseTanzil, splitBasmala, type QuranMeta } from './quran'
import { nextOccurrence, yearsAt } from './dates'
import { daysLeftLabel, nextLecture } from './uni'

describe('hijri calendar', () => {
  it('matches Umm al-Qura for known dates', () => {
    expect(hijriOf('2026-02-18')).toEqual({ year: 1447, month: 9, day: 1 }) // 1 Ramadan
    expect(hijriOf('2026-03-20')).toEqual({ year: 1447, month: 10, day: 1 }) // Eid al-Fitr
    expect(hijriOf('2026-05-26')).toEqual({ year: 1447, month: 12, day: 9 }) // Arafah
    expect(hijriOf('2026-06-25')).toEqual({ year: 1448, month: 1, day: 10 }) // Ashura
  })

  it('applies the local adjustment', () => {
    expect(hijriOf('2026-02-18', -1)).toEqual({ year: 1447, month: 8, day: 29 }) // Sha'ban 1447 had 29 days
  })

  it('tabular fallback stays within a couple of days', () => {
    const t = tabularHijri('2026-02-18')
    expect(t.year).toBe(1447)
    expect([8, 9]).toContain(t.month)
  })

  it('lists every day of Ramadan', () => {
    const days = hijriMonthDays(1447, 9)
    expect(days[0]).toBe('2026-02-18')
    expect(days.at(-1)).toBe('2026-03-19')
    expect(days).toHaveLength(30)
    expect(hijriMonthDays(1448, 9)[0]).toBe('2027-02-08')
  })
})

describe('fasting', () => {
  it('suggests sunnah fasts and never on forbidden days or in Ramadan', () => {
    expect(sunnahHints('2026-05-26').map((h) => h.key)).toContain('arafah')
    expect(sunnahHints('2026-06-25').map((h) => h.key)).toContain('ashura')
    expect(sunnahHints('2026-10-22').map((h) => h.key)).toContain('thursday')
    expect(sunnahHints('2026-10-24').map((h) => h.key)).toContain('bid') // 13 Jumada al-Ula
    expect(isForbiddenFastDay('2026-03-20')).toBe('Eid al-Fitr')
    expect(sunnahHints('2026-03-20')).toEqual([]) // Eid on a Friday… and never a hint
    expect(sunnahHints('2026-05-30')).toEqual([]) // 13 Dhul Hijjah: Tashreeq, even though it's a white day
    expect(sunnahHints('2026-02-19')).toEqual([]) // Thursday in Ramadan
  })

  it('counts missed Ramadan days since tracking started, minus qada made up', () => {
    const fasts: Fast[] = [{ day: '2026-02-18', type: 'ramadan' }, { day: '2026-02-19', type: 'ramadan' }, { day: '2026-04-01', type: 'qada' }]
    const missed = missedRamadanDays(fasts, '2026-02-18', '2026-02-23')
    expect(missed).toEqual(['2026-02-20', '2026-02-21', '2026-02-22'])
    expect(qadaFastCount(5, missed.length, fasts)).toBe(7)
    expect(missedRamadanDays(fasts, null, '2026-04-01')).toEqual([])
  })
})

describe('uni & dates', () => {
  const lec = (weekday: number, start: string, end: string, course = 'Analysis') =>
    ({ id: course + weekday + start, course, type: 'lecture' as const, weekday, start, end, room: 'H1', color: null })

  it('finds the current or next lecture within the semester', () => {
    const lectures = [lec(3, '10:00', '12:00'), lec(4, '08:00', '10:00', 'Physics')]
    const wed = new Date(2026, 9, 21, 11, 0)
    expect(nextLecture(lectures, '2026-10-01', '2027-02-01', wed)).toMatchObject({ day: '2026-10-21', now: true })
    const after = new Date(2026, 9, 21, 12, 30)
    expect(nextLecture(lectures, '2026-10-01', '2027-02-01', after)?.lecture.course).toBe('Physics')
    expect(nextLecture(lectures, '2026-12-01', '2027-02-01', wed)).toBeNull() // semester more than two weeks away
  })

  it('computes next yearly occurrence, ages and days left', () => {
    expect(nextOccurrence({ month: 10, day: 21 }, '2026-10-21')).toBe('2026-10-21')
    expect(nextOccurrence({ month: 3, day: 1 }, '2026-10-21')).toBe('2027-03-01')
    expect(nextOccurrence({ month: 2, day: 29 }, '2026-10-21')).toBe('2027-02-28')
    expect(yearsAt({ id: 'x', title: 'Mum', kind: 'birthday', month: 3, day: 1, year: 1970 }, '2026-10-21')).toBe(57)
    expect(daysLeftLabel('2026-10-26', '2026-10-21')).toBe('in 5 days')
  })
})

describe('quran helpers', () => {
  it('parses the Tanzil format and keeps the notice', () => {
    const q = parseTanzil('1|1|a\n1|2|b\n2|1|a c\n\n# Tanzil notice\n#  line two\n')
    expect(q.ayat[1][0]).toBe('a c')
    expect(q.notice).toEqual(['Tanzil notice', ' line two'])
    expect(splitBasmala(q, 2, 1)).toEqual({ basmala: 'a', rest: 'c' })
    expect(splitBasmala(q, 1, 1)).toEqual({ basmala: null, rest: 'a' })
    // Basmala with an extra shadda (as in 95:1): recognised, and its own spelling kept.
    const v = parseTanzil('1|1|بِسْمِ ٱللَّهِ\n95|1|بِّسْمِ ٱللَّهِ وَٱلتِّينِ\n96|1|ٱقْرَأْ بِٱسْمِ\n')
    expect(splitBasmala(v, 95, 1)).toEqual({ basmala: 'بِّسْمِ ٱللَّهِ', rest: 'وَٱلتِّينِ' })
    expect(splitBasmala(v, 96, 1).basmala).toBeNull()
    expect(arabicNumber(286)).toBe('٢٨٦')
  })

  it('tracks khatma pages and where to continue', () => {
    const reads = [1, 2, 3, 3, 5].map((page, i) => ({ id: String(i), day: '2026-10-21', page, source: 'reader' as const, at: 100 + i }))
    const pages = khatmaPages(reads, 101)
    expect([...pages].sort()).toEqual([2, 3, 5])
    expect(nextUnreadPage(new Set([1, 2, 3]))).toBe(4)
    expect(nextUnreadPage(new Set([2]))).toBe(3)
    expect(nextUnreadPage(new Set([603, 604, 1]))).toBe(2)
    expect(nextUnreadPage(new Set())).toBe(1)
  })

  // Runs where the real Tanzil data was fetched; skipped locally without it, but never skipped in CI.
  const metaPath = new URL('../data/tanzil/quran-meta.json', import.meta.url)
  const textPath = new URL('../data/tanzil/quran-uthmani.txt', import.meta.url)
  it.skipIf((!existsSync(metaPath) || !existsSync(textPath)) && !process.env.CI)('real Tanzil data: 604 pages covering all 6236 ayat once', () => {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as QuranMeta
    const text = parseTanzil(readFileSync(textPath, 'utf8'))
    expect(pageAyat(meta, 1).map((x) => `${x.sura}:${x.aya}`)).toEqual(['1:1', '1:2', '1:3', '1:4', '1:5', '1:6', '1:7'])
    expect(pageAyat(meta, 2)[0]).toEqual({ sura: 2, aya: 1 })
    expect(pageAyat(meta, 604).map((x) => x.sura)).toEqual([112, 112, 112, 112, 113, 113, 113, 113, 113, 114, 114, 114, 114, 114, 114])
    let total = 0
    const seen = new Set<string>()
    for (let p = 1; p <= 604; p++) for (const x of pageAyat(meta, p)) { total++; seen.add(`${x.sura}:${x.aya}`) }
    expect(total).toBe(6236)
    expect(seen.size).toBe(6236)
    expect(pageOf(meta, 2, 255)).toBe(42)
    expect(pageOf(meta, 18, 1)).toBe(293)
    expect(juzOfPage(meta, 582)).toBe(30)
    expect(splitBasmala(text, 2, 1).basmala).toBe(text.ayat[0][0])
    expect(splitBasmala(text, 9, 1).basmala).toBeNull()
    for (let s = 2; s <= 114; s++) {
      if (s === 9) continue
      const { basmala, rest } = splitBasmala(text, s, 1)
      expect(basmala, `surah ${s}`).not.toBeNull()
      // Splitting must not lose or change a single character.
      expect(`${basmala} ${rest}`, `surah ${s}`).toBe(text.ayat[s - 1][0])
    }
    expect(text.notice.join(' ')).toMatch(/tanzil/i)
  })
})
