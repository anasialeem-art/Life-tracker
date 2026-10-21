// The KFGQPC V4 (1441H) tajweed mushaf: 604 pages of 15 lines (8 on pages 1–2), as printed.
//
// - Page data (which glyphs are on which line) is QUL's open data, compiled at build time by
//   scripts/fetch-mushaf.mjs and bundled as a lazily loaded chunk.
// - The fonts are the King Fahd Complex fonts as published by QUL (https://qul.tarteel.ai): one
//   colour font per page with the tajweed colours and ayah rosettes, plus the surah-name font and
//   quran-common (the header frame). They are not part of the app: the phone downloads them once
//   from QUL's CDN and keeps them in Cache Storage, so the reader works offline afterwards.
// Layout and palettes follow tlawat/remotion-mushaf-line (MIT), which renders the same data.

import { getMeta, setMeta } from './db'

export type MushafLine =
  | readonly ['s', number] // surah header
  | readonly ['b'] // basmala
  | readonly ['a', 0 | 1, string, number, number] // ayah line: centred?, glyphs, first surah/ayah on it

const dataModules = import.meta.glob<{ pages: MushafLine[][] }>('../data/mushaf/qpc-v4.json', { import: 'default' })

/** Whether this build carries the mushaf page data. */
export const HAS_MUSHAF = Object.keys(dataModules).length > 0

let dataPromise: Promise<MushafLine[][] | null> | null = null
export function loadMushafPages(): Promise<MushafLine[][] | null> {
  dataPromise ??= (async () => {
    const load = Object.values(dataModules)[0]
    return load ? (await load()).pages : null
  })()
  return dataPromise
}

// ---- Metrics (font units) -----------------------------------------------------------

/** Page fonts and the surah-name font: 2500 units per em, pinned ascent/descent. */
const PAGE_UPM = 2500
const PAGE_ASCENT = 3940
const PAGE_DESCENT = -2520
/** The widest line of the mushaf, so a type size from it never overflows the measure. */
export const REFERENCE_LINE_WIDTH = 42501
/** quran-common: 1024 units, its own metrics. The header frame is 8240 units wide. */
const COMMON_UPM = 1024
const COMMON_ASCENT = 819
const COMMON_DESCENT = -205
const FRAME_ADVANCE = 8240

export const LINE_HEIGHT_EM = 2.2
export const fontSizeForWidth = (width: number) => (width * PAGE_UPM) / REFERENCE_LINE_WIDTH
export const frameFontSize = (fontSize: number) => (fontSize * (REFERENCE_LINE_WIDTH / PAGE_UPM)) / (FRAME_ADVANCE / COMMON_UPM)
/** Vertical shift (em) that centres a glyph's ink in its line box. */
export const SURAH_NAME_SHIFT_EM = (449 - (PAGE_ASCENT + PAGE_DESCENT) / 2) / PAGE_UPM
export const FRAME_SHIFT_EM = (320 - (COMMON_ASCENT + COMMON_DESCENT) / 2) / COMMON_UPM

// ---- Glyphs of the shared fonts ------------------------------------------------------

/** Surah-name font: U+FC45–FC64 for 1–21, U+FB51–FBEB for 22–114 (with gaps), in surah order. */
const SURAH_NAME_GLYPHS =
  'ﱅﱆﱇﱊﱋﱎﱏﱑﱒﱓﱕﱖﱘﱚﱛﱜﱝﱞﱡﱢﱤ' +
  'ﭑﭒﭔﭕﭗﭘﭚﭛﭝﭞﭠﭡﭣﭤﭦﭧﭩﭪﭬﭭ' +
  'ﭯﭰﭲﭳﭵﭶﭸﭹﭻﭼﭾﭿﮁﮂﮄﮅﮇﮈﮊﮋ' +
  'ﮍﮎﮐﮑﮓﮔﮖﮗﮙﮚﮜﮝﮟﮠﮢﮣﮥﮦﮨﮩ' +
  'ﮫﮬﮮﮯﮱ﮲﮴﮵﮷﮸﮺﮻﮽﮾﯀﯁ﯓﯔﯖﯗ' +
  'ﯙﯚﯜﯝﯟﯠﯢﯣﯥﯦﯨﯩﯫ'
export const surahNameGlyph = (surah: number) => SURAH_NAME_GLYPHS[surah - 1]
/** The basmala as printed under a surah header (four glyphs, visual order). */
export const BASMALA_GLYPHS = 'ﲪﲫﲮﲴ'
/** The ornamental frame around a surah name (quran-common). */
export const FRAME_GLYPH = ''

// ---- Fonts: QUL's CDN, cached once for offline use ---------------------------------------

const QUL_FONTS = 'https://static-cdn.tarteel.ai/qul/fonts'
export const pageFontUrl = (page: number) =>
  page === 328 // the one page QUL publishes without a woff2
    ? `${QUL_FONTS}/quran_fonts/v4-tajweed/woff/p328.woff?v=3.1`
    : `${QUL_FONTS}/quran_fonts/v4-tajweed/woff2/p${page}.woff2?v=3.1`
export const SURAH_NAMES_URL = `${QUL_FONTS}/surah_names_v4/surah_names.woff2`
export const COMMON_URL = `${QUL_FONTS}/common/quran-common.woff2`
export const ALL_FONT_URLS = [SURAH_NAMES_URL, COMMON_URL, ...Array.from({ length: 604 }, (_, i) => pageFontUrl(i + 1))]
/** Roughly what the 606 fonts weigh together. */
export const DOWNLOAD_MB = 52

const CACHE = 'mushaf-fonts-v1'

async function openCache(): Promise<Cache | null> {
  try {
    return 'caches' in self ? await caches.open(CACHE) : null
  } catch {
    return null
  }
}

async function cachedResponse(url: string): Promise<Response | null> {
  const cache = await openCache()
  return (await cache?.match(url, { ignoreVary: true })) ?? null
}

/** The font file: from the offline cache, else downloaded once and stored. */
async function fontBytes(url: string): Promise<ArrayBuffer> {
  const hit = await cachedResponse(url)
  if (hit) return hit.arrayBuffer()
  const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const cache = await openCache()
  await cache?.put(url, res.clone())
  return res.arrayBuffer()
}

const faces = new Map<string, Promise<string>>()

function loadFace(family: string, url: string, ascent: number, descent: number, upm: number): Promise<string> {
  let p = faces.get(family)
  if (!p) {
    p = (async () => {
      const face = new FontFace(family, await fontBytes(url), {
        ascentOverride: `${(ascent / upm) * 100}%`,
        descentOverride: `${(-descent / upm) * 100}%`,
        lineGapOverride: '0%',
      })
      await face.load()
      document.fonts.add(face)
      return family
    })()
    p.catch(() => faces.delete(family)) // allow a retry later (e.g. back online)
    faces.set(family, p)
  }
  return p
}

export const pageFamily = (page: number) => `qpc-v4t-p${page}`
export const SURAH_NAMES_FAMILY = 'qpc-v4-surah-names'
export const COMMON_FAMILY = 'qpc-v4-common'

export const loadPageFont = (page: number) => loadFace(pageFamily(page), pageFontUrl(page), PAGE_ASCENT, PAGE_DESCENT, PAGE_UPM)
export const loadSharedFonts = () => Promise.all([
  loadFace(SURAH_NAMES_FAMILY, SURAH_NAMES_URL, PAGE_ASCENT, PAGE_DESCENT, PAGE_UPM),
  loadFace(COMMON_FAMILY, COMMON_URL, COMMON_ASCENT, COMMON_DESCENT, COMMON_UPM),
])

// ---- Colour palettes ----------------------------------------------------------------------
// The colour fonts' 16 CPAL entries: 0 letters, 1/2/15 silent-letter greys, 3–9 the tajweed rule
// colours, 10–13 the ayah rosette, 14 thin rings around small connective letters. These are QUL's
// own Light and Dark themes.

export type MushafTheme = 'light' | 'dark'

const PALETTES: Record<MushafTheme, { base: number; colors: string[] }> = {
  light: {
    base: 0,
    colors: ['#000000', '#a5a5a5', '#a5a5a5', '#b50000', '#ff7b00', '#ce9e00', '#09b000', '#3f48e6', '#2fadff', '#f40000', '#2ca4ab', '#ff0080', '#d8e9d8', '#000000', 'transparent', '#a5a5a5'],
  },
  dark: {
    base: 5,
    colors: ['#e8e8e8', '#b0b0b0', '#b0b0b0', '#ff6b6b', '#ffa94d', '#ffd93d', '#6bcb77', '#4d96ff', '#00d9ff', '#ff4d6d', '#26c6da', '#ff80ab', '#343a40', '#e8e8e8', 'transparent', '#b0b0b0'],
  },
}
export const INK: Record<MushafTheme, string> = { light: '#111111', dark: '#e8e8e8' }

const registered = new Set<string>()

/** `font-palette` ident for a page in a theme; registers its @font-palette-values rule once. */
export function paletteFor(page: number, theme: MushafTheme): string {
  const ident = `--qpc-${theme}-p${page}`
  if (!registered.has(ident)) {
    registered.add(ident)
    let el = document.getElementById('qpc-palettes') as HTMLStyleElement | null
    if (!el) {
      el = document.createElement('style')
      el.id = 'qpc-palettes'
      document.head.appendChild(el)
    }
    const p = PALETTES[theme]
    const overrides = p.colors.map((c, i) => `${i} ${c}`).join(',')
    el.appendChild(document.createTextNode(`@font-palette-values ${ident}{font-family:"${pageFamily(page)}";base-palette:${p.base};override-colors:${overrides}}\n`))
  }
  return ident
}

// ---- Offline download ------------------------------------------------------------------------

export interface DownloadState { done: number; total: number; running: boolean; error: string | null }

let state: DownloadState = { done: 0, total: ALL_FONT_URLS.length, running: false, error: null }
const listeners = new Set<(s: DownloadState) => void>()
const emit = (patch: Partial<DownloadState>) => {
  state = { ...state, ...patch }
  listeners.forEach((l) => l(state))
}

export function subscribeDownload(fn: (s: DownloadState) => void): () => void {
  listeners.add(fn)
  fn(state)
  return () => listeners.delete(fn)
}

/** Counts the fonts already stored for offline use. */
export async function refreshDownloadCount(): Promise<number> {
  const cache = await openCache()
  if (!cache) return 0
  const keys = new Set((await cache.keys()).map((r) => r.url))
  const done = ALL_FONT_URLS.filter((u) => keys.has(u)).length
  emit({ done })
  if (done === ALL_FONT_URLS.length) await setMeta('mushafDownloaded', true)
  return done
}

export const isMushafDownloaded = async () => (await getMeta<boolean>('mushafDownloaded')) === true

/** Downloads every font not yet stored (4 at a time). Safe to call repeatedly; resumes where it stopped. */
export async function downloadMushaf(): Promise<void> {
  if (state.running) return
  const cache = await openCache()
  if (!cache) return emit({ error: 'This browser can’t store files for offline use.' })
  emit({ running: true, error: null })
  const have = new Set((await cache.keys()).map((r) => r.url))
  const todo = ALL_FONT_URLS.filter((u) => !have.has(u))
  let done = ALL_FONT_URLS.length - todo.length
  emit({ done })
  let failed = 0
  const worker = async () => {
    while (todo.length) {
      if (!navigator.onLine) throw new Error('offline')
      const url = todo.shift()!
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        await cache.put(url, res)
        emit({ done: ++done })
      } catch {
        failed++
        if (failed > 20) throw new Error('download keeps failing')
      }
    }
  }
  try {
    await Promise.all([worker(), worker(), worker(), worker()])
    if (done === ALL_FONT_URLS.length) await setMeta('mushafDownloaded', true)
    emit({ running: false, error: done === ALL_FONT_URLS.length ? null : `${ALL_FONT_URLS.length - done} files failed; tap to retry.` })
  } catch (e) {
    emit({ running: false, error: (e as Error).message === 'offline' ? 'Paused: you’re offline.' : 'Download stopped; tap to retry.' })
  }
}

// ---- Hizb ---------------------------------------------------------------------------------------

/** Rub' al-hizb (0-based, 0–239) a given ayah falls in, from Tanzil's quarter starts. */
export function quarterOf(quarters: [number, number][], sura: number, aya: number): number {
  let q = 0
  for (let i = 0; i < quarters.length; i++) {
    const [s, a] = quarters[i]
    if (s < sura || (s === sura && a <= aya)) q = i
    else break
  }
  return q
}

// ---- Page index of this edition --------------------------------------------------------------
// The 1441H print starts some pages an ayah or two away from other Madani indexes (e.g. Tanzil's),
// so headers and "go to" use the mushaf's own lines when it is shown.

export interface MushafIndex {
  /** First ayah [surah, ayah] printed on each page (index = page - 1). */
  first: [number, number][]
  /** Surahs with text or a header on each page. */
  surahs: number[][]
  /** Page of each surah's header (index = surah - 1). */
  surahStart: number[]
}

export function indexMushaf(pages: MushafLine[][]): MushafIndex {
  const first: [number, number][] = []
  const surahs: number[][] = []
  const surahStart: number[] = []
  pages.forEach((lines, i) => {
    const set = new Set<number>()
    let f: [number, number] | null = null
    for (const l of lines) {
      if (l[0] === 's') { set.add(l[1]); surahStart[l[1] - 1] ??= i + 1 }
      if (l[0] === 'a') { set.add(l[3]); f ??= [l[3], l[4]] }
    }
    first.push(f ?? first[i - 1] ?? [1, 1])
    surahs.push([...set].sort((a, b) => a - b))
  })
  return { first, surahs, surahStart }
}

/** Page on which an ayah is printed in this edition. */
export function mushafPageOf(index: MushafIndex, sura: number, aya: number): number {
  let page = 1
  for (let i = 0; i < index.first.length; i++) {
    const [s, a] = index.first[i]
    if (s < sura || (s === sura && a <= aya)) page = i + 1
    else break
  }
  return page
}

let indexPromise: Promise<MushafIndex | null> | null = null
export function loadMushafIndex(): Promise<MushafIndex | null> {
  indexPromise ??= loadMushafPages().then((p) => (p ? indexMushaf(p) : null))
  return indexPromise
}
