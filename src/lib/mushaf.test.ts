import { describe, expect, it } from 'vitest'
// @ts-expect-error plain JS build script
import { compile, pageStarts, parseWords } from '../../scripts/lib/mushaf-compile.mjs'
import { indexMushaf, mushafPageOf, type MushafLine } from './mushaf'

describe('mushaf compile', () => {
  // A tiny made-up layout in QUL's export shape: page 1 = header, basmala-less ayah lines.
  const words = parseWords({
    '1:1:1': { id: 1, location: '1:1:1', text: 'ﱁ' },
    '1:1:2': { id: 2, location: '1:1:2', text: 'ﱂ' },
    '1:2:1': { id: 3, location: '1:2:1', text: 'ﱃ' },
    '1:2:2': { id: 4, location: '1:2:2', text: 'ﱄ ' },
  })

  it('derives ayah markers as the last word of each ayah', () => {
    expect([...words.values()].map((w: { end: boolean }) => w.end)).toEqual([false, true, false, true])
    expect(words.get(4).text).toBe('ﱄ') // whitespace stripped
  })

  it('joins layout rows with words, page by page', () => {
    const rows = [
      { page_number: 1, line_number: 1, line_type: 'surah_name', surah_number: 1, first_word_id: '', last_word_id: '', is_centered: 1 },
      { page_number: 1, line_number: 2, line_type: 'ayah', first_word_id: 1, last_word_id: 2, is_centered: 0 },
      { page_number: 1, line_number: 3, line_type: 'ayah', first_word_id: 3, last_word_id: 4, is_centered: 0 },
      { page_number: 3, line_number: 1, line_type: 'basmallah' },
      { page_number: 3, line_number: 2, line_type: 'ayah', first_word_id: 3, last_word_id: 3, is_centered: 1 },
    ]
    const pages = compile(rows, words)
    expect(pages[0]).toEqual([['s', 1], ['a', 1, 'ﱁﱂ', 1, 1], ['a', 1, 'ﱃﱄ', 1, 2]]) // page 1 always centred
    expect(pages[2]).toEqual([['b'], ['a', 1, 'ﱃ', 1, 2]])
    expect(pageStarts([pages[0]])).toEqual([[1, 1]])
    expect(() => compile([{ page_number: 1, line_number: 1, line_type: 'ayah', first_word_id: 9, last_word_id: 9 }], words)).toThrow(/missing word 9/)
  })
})

describe('mushaf page index', () => {
  it('uses the edition\'s own page starts and surah headers', () => {
    const pages: MushafLine[][] = [
      [['s', 1], ['a', 1, 'x', 1, 1]],
      [['a', 0, 'x', 1, 5], ['s', 2], ['b'], ['a', 0, 'x', 2, 1]],
      [['a', 0, 'x', 2, 6]],
    ]
    const idx = indexMushaf(pages)
    expect(idx.first).toEqual([[1, 1], [1, 5], [2, 6]])
    expect(idx.surahs[1]).toEqual([1, 2])
    expect(idx.surahStart).toEqual([1, 2])
    expect(mushafPageOf(idx, 2, 3)).toBe(2)
    expect(mushafPageOf(idx, 2, 6)).toBe(3)
  })
})

describe('real mushaf data', async () => {
  const { existsSync, readFileSync } = await import('node:fs')
  const { juzOfPage } = await import('./quran')
  const { quarterOf } = await import('./mushaf')
  const mushafPath = new URL('../data/mushaf/qpc-v4.json', import.meta.url)
  const metaPath = new URL('../data/tanzil/quran-meta.json', import.meta.url)
  const have = existsSync(mushafPath) && existsSync(metaPath)
  // Runs where the real data was fetched; never skipped in CI.
  it.skipIf(!have && !process.env.CI)('matches a printed tajweed mushaf (page 305: Maryam, Juz 16, Hizb 31)', () => {
    const pages = JSON.parse(readFileSync(mushafPath, 'utf8')).pages as MushafLine[][]
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    const idx = indexMushaf(pages)
    expect(idx.surahStart).toHaveLength(114)
    for (let s = 1; s < 114; s++) expect(idx.surahStart[s], `surah ${s + 1}`).toBeGreaterThanOrEqual(idx.surahStart[s - 1])
    expect(idx.surahStart[0]).toBe(1)
    expect(idx.surahStart[1]).toBe(2)
    expect(idx.surahStart[18]).toBe(305) // Maryam
    expect(idx.first[304]).toEqual([19, 1])
    expect(juzOfPage(meta, 305, idx.first[304])).toBe(16)
    expect(meta.quarters).toHaveLength(240)
    expect(Math.floor(quarterOf(meta.quarters, 19, 1) / 4) + 1).toBe(31)
    expect(pages[304].map((l) => l[0])).toEqual(['s', 'b', ...Array(13).fill('a')])
  })
})
