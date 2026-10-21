import { describe, expect, it } from 'vitest'
// @ts-expect-error plain JS build script
import { compile, pageStarts, parseWords } from '../../scripts/lib/mushaf-compile.mjs'

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
