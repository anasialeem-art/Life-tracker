// Downloads the Quran text and page/juz/surah metadata from Tanzil.net and
// stores them in src/data/tanzil/ for the build to bundle.
//
// - quran-uthmani.txt is saved byte-for-byte as served by Tanzil (unmodified,
//   including its license notice). The app reads it as-is.
// - quran-data.js (metadata) is evaluated and saved as quran-meta.json so the
//   app gets the 604 Madani page boundaries, juz starts and surah names.
//
// Usage: node scripts/fetch-tanzil.mjs [--strict]
//   --strict  fail if the download or validation fails (used by CI deploys)

import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'tanzil')
const STRICT = process.argv.includes('--strict')

const TEXT_URLS = [
  'https://tanzil.net/pub/download/index.php?marks=true&sajdah=true&rub=true&tatweel=true&quranType=uthmani&outType=txt-2&agree=true',
]
const META_URLS = ['https://tanzil.net/res/text/metadata/quran-data.js']

async function download(urls) {
  let last
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'life-tracker-build' } })
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (e) {
      last = e
    }
  }
  throw last
}

/** Throws unless the text has exactly 6236 "sura|aya|text" lines covering 114 surahs. */
export function validateText(text) {
  const lines = text.split(/\r?\n/).filter((l) => l && !l.startsWith('#'))
  if (lines.length !== 6236) throw new Error(`Expected 6236 ayat, got ${lines.length}`)
  const suras = new Set()
  for (const l of lines) {
    const m = l.match(/^(\d+)\|(\d+)\|(.+)$/)
    if (!m) throw new Error(`Unexpected line: ${l.slice(0, 40)}`)
    suras.add(+m[1])
  }
  if (suras.size !== 114) throw new Error(`Expected 114 surahs, got ${suras.size}`)
}

function parseMeta(js) {
  const ctx = {}
  vm.runInNewContext(`${js}\n;this.QuranData = QuranData;`, ctx, { timeout: 2000 })
  const q = ctx.QuranData
  // Sura: [start, ayas, order, rukus, name, tname, ename, type]; index 0 empty, last a sentinel.
  const suras = q.Sura.slice(1, 115).map(([, ayas, , , name, tname, ename, type], i) => ({ n: i + 1, ayas, name, tname, ename, type }))
  // Page / Juz: [sura, aya] start positions, index 0 empty, followed by a [115, 1] sentinel.
  const pages = q.Page.slice(1).map(([s, a]) => [s, a])
  const juz = q.Juz.slice(1).map(([s, a]) => [s, a])
  const sajda = (q.Sajda ?? []).slice(1).map(([s, a]) => [s, a])
  // Rub' al-hizb starts (Tanzil spells the field "HizbQaurter"): 240 quarters, 4 per hizb.
  const quarters = (q.HizbQaurter ?? q.HizbQuarter ?? []).slice(1).filter((x) => x && x.length === 2).map(([s, a]) => [s, a]).slice(0, 240)
  return { suras, pages, juz, sajda, quarters }
}

/** Throws unless the metadata matches the standard Madani mushaf. */
export function validateMeta(meta) {
  if (meta.suras.length !== 114) throw new Error(`Expected 114 surahs, got ${meta.suras.length}`)
  const ayas = meta.suras.reduce((n, s) => n + s.ayas, 0)
  if (ayas !== 6236) throw new Error(`Surah lengths add up to ${ayas}, not 6236`)
  // 604 page starts plus the sentinel.
  if (meta.pages.length !== 605) throw new Error(`Expected 604 pages (+ sentinel), got ${meta.pages.length}`)
  if (meta.juz.length !== 31) throw new Error(`Expected 30 juz (+ sentinel), got ${meta.juz.length}`)
  if (meta.quarters && meta.quarters.length !== 240) throw new Error(`Expected 240 hizb quarters, got ${meta.quarters.length}`)
  const [p1, p2] = meta.pages
  if (p1.join() !== '1,1' || p2.join() !== '2,1') throw new Error('Page 1 should be al-Fatiha and page 2 start al-Baqarah')
}

async function exists(p) {
  try { await access(p); return true } catch { return false }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const textPath = join(OUT, 'quran-uthmani.txt')
  const metaPath = join(OUT, 'quran-meta.json')
  try {
    const textBuf = await download(TEXT_URLS)
    validateText(textBuf.toString('utf8'))
    const meta = parseMeta((await download(META_URLS)).toString('utf8'))
    validateMeta(meta)
    await writeFile(textPath, textBuf)
    await writeFile(metaPath, JSON.stringify({ source: 'https://tanzil.net/res/text/metadata/quran-data.js', ...meta }))
    console.log(`Tanzil: saved Quran text (${textBuf.length} bytes) and metadata (${meta.pages.length - 1} pages).`)
    if (process.env.GITHUB_ACTIONS) {
      // Build notices are readable from the GitHub API, so the data can be checked without downloading it.
      const lines = textBuf.toString('utf8').split(/\r?\n/)
      const first = (ref) => lines.find((l) => l.startsWith(ref))?.split('|')[2] ?? ''
      const comments = lines.filter((l) => l.startsWith('#')).length
      const cps = (s) => [...s].slice(0, 12).map((c) => c.codePointAt(0).toString(16)).join(' ')
      console.log(`::notice title=Tanzil data::bytes=${textBuf.length} pages=${meta.pages.length - 1} juz=${meta.juz.length - 1} sajda=${meta.sajda.length} commentLines=${comments} surah2=${meta.suras[1].tname}/${meta.suras[1].ayas} page3=${meta.pages[2].join(':')} page604=${meta.pages[603].join(':')} juz30=${meta.juz[29].join(':')}`)
      console.log(`::notice title=Tanzil 2:1 and 1:1::2:1=[${cps(first('2|1|'))}] len=${first('2|1|').length}; 1:1=[${cps(first('1|1|'))}]; 9:1 starts=[${cps(first('9|1|'))}]`)
    }
  } catch (e) {
    if (await exists(textPath) && await exists(metaPath)) {
      validateText(await readFile(textPath, 'utf8'))
      validateMeta(JSON.parse(await readFile(metaPath, 'utf8')))
      console.warn(`Tanzil: download failed (${e.message}); using the existing local copy.`)
      return
    }
    if (STRICT) {
      console.error(`${process.env.GITHUB_ACTIONS ? '::error title=Tanzil::' : ''}Tanzil: could not get the Quran text: ${e.message}`)
      process.exit(1)
    }
    console.warn(`Tanzil: could not get the Quran text (${e.message}). Building without it; the Quran reader will say so.`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
