// Turns QUL's two open exports for the KFGQPC V4 (1441H) mushaf into the app's page data:
// the words of the script (each word is 1–4 private-use code points the page font draws) and the
// 15-line layout (which words are on which line). Layout logic follows tlawat/remotion-mushaf-line
// (MIT), which reads the same exports.

export const PAGES = 604
export const INVARIANTS = { lines: 9046, ayahLines: 8820, surahNameLines: 114, basmallahLines: 112, words: 83668, ayahs: 6236 }
/** Pages 1 and 2 are printed fully centred whatever the export's flags say. */
const CENTERED_PAGES = [1, 2]

const num = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const pick = (r, ...names) => { for (const n of names) if (r[n] !== undefined) return r[n] }

/** Words keyed by QUL word id: { surah, ayah, position, text, end } (end = the ayah-number marker). */
export function parseWords(json) {
  const rows = Array.isArray(json) ? json : Object.values(json ?? {})
  if (!rows.length) throw new Error('words export is empty')
  const words = new Map()
  for (const [i, r] of rows.entries()) {
    const id = num(pick(r, 'id', 'word_index', 'word_number_all', 'word_id'))
    let surah = num(pick(r, 'surah', 'surah_number', 'chapter_id'))
    let ayah = num(pick(r, 'ayah', 'ayah_number', 'verse_number'))
    let position = num(pick(r, 'word', 'position', 'word_number', 'word_position'))
    if (typeof r.location === 'string' && /^\d+:\d+:\d+$/.test(r.location)) {
      const [s, a, w] = r.location.split(':').map(Number)
      surah ??= s; ayah ??= a; position ??= w
    }
    const text = String(pick(r, 'text', 'code_v4', 'code_v2', 'qpc_v4') ?? '').replace(/\s+/gu, '')
    if (id === null || surah === null || ayah === null || position === null || !text) throw new Error(`words export: cannot read entry ${i}`)
    if (words.has(id)) throw new Error(`words export: word id ${id} twice`)
    words.set(id, { surah, ayah, position, text })
  }
  const last = new Map()
  for (const w of words.values()) last.set(`${w.surah}:${w.ayah}`, Math.max(last.get(`${w.surah}:${w.ayah}`) ?? 0, w.position))
  for (const w of words.values()) w.end = w.position === last.get(`${w.surah}:${w.ayah}`)
  return words
}

/**
 * Pages → lines. A line is one of
 *   ['s', surah]                     surah header (frame + name)
 *   ['b']                            basmala
 *   ['a', centered, text, s, a]      ayah line: the glyphs in reading order, and the first ayah on it
 */
export function compile(layoutRows, words) {
  const pages = Array.from({ length: PAGES }, () => [])
  for (const r of layoutRows) {
    const page = num(r.page_number)
    const line = num(r.line_number)
    const type = r.line_type
    if (!page || page > PAGES || !line) throw new Error(`layout: bad row ${JSON.stringify(r)}`)
    let out
    if (type === 'surah_name') {
      const s = num(r.surah_number)
      if (!s) throw new Error(`layout: page ${page} line ${line} surah_name without surah`)
      out = ['s', s]
    } else if (type === 'basmallah') out = ['b']
    else if (type === 'ayah') {
      const first = num(r.first_word_id)
      const lastId = num(r.last_word_id)
      if (first === null || lastId === null || lastId < first) throw new Error(`layout: page ${page} line ${line} bad word range`)
      let text = ''
      for (let id = first; id <= lastId; id++) {
        const w = words.get(id)
        if (!w) throw new Error(`layout: page ${page} line ${line} references missing word ${id}`)
        text += w.text
      }
      const w0 = words.get(first)
      const centered = num(r.is_centered) === 1 || r.is_centered === true || CENTERED_PAGES.includes(page)
      out = ['a', centered ? 1 : 0, text, w0.surah, w0.ayah]
    } else throw new Error(`layout: unknown line_type ${type}`)
    pages[page - 1][line - 1] = out
  }
  pages.forEach((p, i) => {
    for (let l = 0; l < p.length; l++) if (!p[l]) throw new Error(`layout: page ${i + 1} is missing line ${l + 1}`)
  })
  return pages
}

/** Throws unless the compiled mushaf matches the printed V4 page's invariants. */
export function validate(pages, words) {
  const count = (t) => pages.reduce((n, p) => n + p.filter((l) => l[0] === t).length, 0)
  const lines = pages.reduce((n, p) => n + p.length, 0)
  const errors = []
  if (pages.length !== PAGES) errors.push(`${pages.length} pages`)
  pages.forEach((p, i) => { if (p.length !== (i < 2 ? 8 : 15)) errors.push(`page ${i + 1} has ${p.length} lines`) })
  if (lines !== INVARIANTS.lines) errors.push(`${lines} lines, expected ${INVARIANTS.lines}`)
  if (count('a') !== INVARIANTS.ayahLines) errors.push(`${count('a')} ayah lines`)
  if (count('s') !== INVARIANTS.surahNameLines) errors.push(`${count('s')} surah headers`)
  if (count('b') !== INVARIANTS.basmallahLines) errors.push(`${count('b')} basmalas`)
  if (words.size !== INVARIANTS.words) errors.push(`${words.size} words`)
  const ends = [...words.values()].filter((w) => w.end).length
  if (ends !== INVARIANTS.ayahs) errors.push(`${ends} ayah markers`)
  for (const w of words.values()) for (const ch of w.text) {
    const cp = ch.codePointAt(0)
    if (cp < 0xfb50 || cp > 0xfdff) { errors.push(`glyph U+${cp.toString(16)} outside the page fonts' range`); break }
  }
  const expect = (cond, msg) => { if (!cond) errors.push(msg) }
  expect(pages[0][0][0] === 's' && pages[0][0][1] === 1, 'page 1 should open with al-Fatiha')
  expect(pages[0][1][0] === 'a' && pages[0][1][3] === 1 && pages[0][1][4] === 1, 'page 1 line 2 should start 1:1')
  expect(pages[186][0][0] === 's' && pages[186][0][1] === 9 && !pages[186].some((l) => l[0] === 'b'), 'page 187: at-Tawbah header, no basmala')
  expect(pages[254][2][0] === 's' && pages[254][2][1] === 14 && pages[254][3][0] === 'b', 'page 255: Ibrahim header then basmala')
  expect(pages[602].filter((l) => l[0] === 's').length === 3 && pages[603].filter((l) => l[0] === 's').length === 3, 'pages 603/604: three surah headers each')
  if (errors.length) throw new Error(`mushaf data check failed: ${errors.slice(0, 8).join('; ')}`)
}

/** First ayah [surah, ayah] printed on each page (for comparing with other page indexes). */
export function pageStarts(pages) {
  return pages.map((p) => { const l = p.find((x) => x[0] === 'a'); return [l[3], l[4]] })
}
