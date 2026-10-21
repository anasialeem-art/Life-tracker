import type { QuranRead } from './db'

// Quran text and Madani page data from Tanzil.net (https://tanzil.net),
// fetched at build time by scripts/fetch-tanzil.mjs. The text is used exactly
// as published; only its layout (pages, basmala line, ayah markers) is ours.

export const TOTAL_PAGES = 604

export interface SurahMeta { n: number; ayas: number; name: string; tname: string; ename: string; type: string }
export interface QuranMeta { suras: SurahMeta[]; pages: [number, number][]; juz: [number, number][]; sajda: [number, number][] }

const metaModules = import.meta.glob<QuranMeta>('../data/tanzil/quran-meta.json', { eager: true, import: 'default' })
const textModules = import.meta.glob<string>('../data/tanzil/quran-uthmani.txt', { query: '?raw', import: 'default' })

/** Page/juz/surah index; null when this build was made without the Tanzil data. */
export const META: QuranMeta | null = Object.values(metaModules)[0] ?? null

export interface QuranText {
  /** ayat[sura - 1][aya - 1] */
  ayat: string[][]
  /** The license/credit comment lines from the Tanzil file, verbatim (without the leading "#"). */
  notice: string[]
}

export function parseTanzil(raw: string): QuranText {
  const ayat: string[][] = []
  const notice: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue
    if (line.startsWith('#')) {
      notice.push(line.replace(/^#\s?/, ''))
      continue
    }
    const i = line.indexOf('|')
    const j = line.indexOf('|', i + 1)
    const s = +line.slice(0, i)
    const a = +line.slice(i + 1, j)
    ;(ayat[s - 1] ??= [])[a - 1] = line.slice(j + 1)
  }
  return { ayat, notice }
}

let loading: Promise<QuranText | null> | null = null

/** Loads the bundled text (a separate chunk, precached for offline use). */
export function loadQuran(): Promise<QuranText | null> {
  loading ??= (async () => {
    const load = Object.values(textModules)[0]
    return load ? parseTanzil(await load()) : null
  })()
  return loading
}

export const cmpRef = (a: [number, number], b: [number, number]) => a[0] - b[0] || a[1] - b[1]

/** Page (1–604) containing a given ayah. */
export function pageOf(meta: QuranMeta, sura: number, aya: number): number {
  let lo = 0
  let hi = TOTAL_PAGES - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (cmpRef(meta.pages[mid], [sura, aya]) <= 0) lo = mid
    else hi = mid - 1
  }
  return lo + 1
}

export interface PageAyah { sura: number; aya: number }

/** Ayat on a page, in order. */
export function pageAyat(meta: QuranMeta, page: number): PageAyah[] {
  const [s0, a0] = meta.pages[page - 1]
  const end = meta.pages[page] // sentinel [115, 1] after page 604
  const out: PageAyah[] = []
  let s = s0
  let a = a0
  while (cmpRef([s, a], end) < 0 && s <= 114) {
    out.push({ sura: s, aya: a })
    a++
    if (a > meta.suras[s - 1].ayas) { s++; a = 1 }
  }
  return out
}

/** Juz of a page (in the Madani mushaf every juz starts at the top of a page). */
export function juzOfPage(meta: QuranMeta, page: number): number {
  const first = meta.pages[page - 1]
  let j = 1
  for (let i = 0; i < 30; i++) if (cmpRef(meta.juz[i], first) <= 0) j = i + 1
  return j
}

export const juzStartPage = (meta: QuranMeta, juz: number) => pageOf(meta, ...meta.juz[juz - 1])
export const surahStartPage = (meta: QuranMeta, sura: number) => pageOf(meta, sura, 1)

/** Surahs that appear on a page (for the reader header). */
export function surahsOnPage(meta: QuranMeta, page: number): number[] {
  return [...new Set(pageAyat(meta, page).map((x) => x.sura))]
}

/**
 * Tanzil prefixes the first ayah of every surah except al-Fatiha and at-Tawbah
 * with the basmala. Splits it off (characters unchanged) so it can be shown as
 * its own centered line, like a printed mushaf. In a few surahs (e.g. 95, 97)
 * the Uthmani basmala carries an extra shadda, so words are compared without it
 * and the surah's own spelling is kept.
 */
export function splitBasmala(text: QuranText, sura: number, aya: number): { basmala: string | null; rest: string } {
  const t = text.ayat[sura - 1][aya - 1]
  if (aya !== 1 || sura === 1) return { basmala: null, rest: t }
  const words = text.ayat[0][0].split(' ')
  const bare = (w: string) => w.replace(/\u0651/g, '')
  let end = 0
  for (const w of words) {
    const next = t.indexOf(' ', end)
    if (next < 0 || bare(t.slice(end, next)) !== bare(w)) return { basmala: null, rest: t }
    end = next + 1
  }
  return { basmala: t.slice(0, end - 1), rest: t.slice(end) }
}

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'
export const arabicNumber = (n: number) => String(n).replace(/\d/g, (d) => AR_DIGITS[+d])

/** Distinct pages read since the khatma started. */
export function khatmaPages(reads: QuranRead[], start: number | null): Set<number> {
  return new Set(reads.filter((r) => start === null || r.at >= start).map((r) => r.page))
}

/** Where to carry on: the first unread page after the furthest one read in this khatma (wrapping round). */
export function nextUnreadPage(pages: Set<number>): number {
  const furthest = Math.max(0, ...pages)
  for (let i = 1; i <= TOTAL_PAGES; i++) {
    const p = ((furthest + i - 1) % TOTAL_PAGES) + 1
    if (!pages.has(p)) return p
  }
  return 1
}
