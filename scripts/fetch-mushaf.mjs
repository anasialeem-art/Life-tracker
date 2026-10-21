// Downloads QUL's open exports for the KFGQPC V4 tajweed mushaf (the words of the script and the
// 15-line layout), checks them and writes src/data/mushaf/qpc-v4.json for the build to bundle.
// The page fonts are not downloaded here: the phone fetches them once from QUL's CDN.
//
// Usage: node scripts/fetch-mushaf.mjs [--strict]

import { mkdir, readFile, writeFile, access, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import { compile, pageStarts, parseWords, validate } from './lib/mushaf-compile.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src', 'data', 'mushaf')
const STRICT = process.argv.includes('--strict')
const GH = !!process.env.GITHUB_ACTIONS

// Pinned publications (QUL re-exports under a new prefix each time); the same ones tlawat pins.
const EXPORTS = 'https://s3.us-east-1.wasabisys.com/static-cdn.tarteel.ai/qul-exports'
const WORDS_URL = `${EXPORTS}/quran-script/1748433334-i11ov-qpc-v4.json.zip`
const LAYOUT_URL = `${EXPORTS}/mushaf-layout/1748288079-a96tc-qpc-v4-tajweed-15-lines.db.zip`

async function download(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return new Uint8Array(await res.arrayBuffer())
}

function onlyFile(zip, ext) {
  const files = unzipSync(zip)
  const name = Object.keys(files).find((n) => n.endsWith(ext))
  if (!name) throw new Error(`no ${ext} file in the zip (${Object.keys(files).join(', ')})`)
  return files[name]
}

async function readLayout(dbBytes) {
  const { DatabaseSync } = await import('node:sqlite')
  const path = join(await mkdtemp(join(tmpdir(), 'mushaf-')), 'layout.db')
  await writeFile(path, dbBytes)
  const db = new DatabaseSync(path, { readOnly: true })
  try { return db.prepare('SELECT * FROM pages').all() } finally { db.close() }
}

async function exists(p) { try { await access(p); return true } catch { return false } }

async function main() {
  await mkdir(OUT, { recursive: true })
  const outPath = join(OUT, 'qpc-v4.json')
  try {
    const words = parseWords(JSON.parse(new TextDecoder().decode(onlyFile(await download(WORDS_URL), '.json'))))
    const rows = await readLayout(onlyFile(await download(LAYOUT_URL), '.db'))
    const pages = compile(rows, words)
    validate(pages, words)
    await writeFile(outPath, JSON.stringify({ source: 'QUL (qul.tarteel.ai) mushaf layout 19, KFGQPC V4 1441H', words: WORDS_URL, layout: LAYOUT_URL, pages }))
    console.log(`Mushaf: ${pages.length} pages, ${words.size} words.`)
    if (GH) {
      // Compare page starts with Tanzil's Madani page index, which the app uses for juz, hizb and logging.
      const metaPath = join(ROOT, 'src', 'data', 'tanzil', 'quran-meta.json')
      let diff = 'tanzil meta missing'
      if (await exists(metaPath)) {
        const meta = JSON.parse(await readFile(metaPath, 'utf8'))
        const starts = pageStarts(pages)
        const off = starts.map((s, i) => [i + 1, s.join(':'), meta.pages[i].join(':')]).filter(([, a, b]) => a !== b)
        diff = `${off.length} pages start differently` + (off.length ? `: ${off.slice(0, 6).map((x) => x.join('/')).join(', ')}` : '')
      }
      // The phone downloads the fonts from QUL's CDN directly, so it must allow other origins (CORS).
      let cors = 'unknown'
      try {
        const r = await fetch('https://static-cdn.tarteel.ai/qul/fonts/quran_fonts/v4-tajweed/woff2/p305.woff2?v=3.1', { method: 'HEAD', headers: { Origin: 'https://anasialeem-art.github.io' } })
        cors = `${r.status} allow-origin=${r.headers.get('access-control-allow-origin')} type=${r.headers.get('content-type')} vary=${r.headers.get('vary')}`
        for (const u of ['https://static-cdn.tarteel.ai/qul/fonts/surah_names_v4/surah_names.woff2', 'https://static-cdn.tarteel.ai/qul/fonts/common/quran-common.woff2', 'https://static-cdn.tarteel.ai/qul/fonts/quran_fonts/v4-tajweed/woff/p328.woff?v=3.1']) {
          const x = await fetch(u, { method: 'HEAD', headers: { Origin: 'https://anasialeem-art.github.io' } })
          cors += ` | ${u.split('/').pop()} ${x.status} ${x.headers.get('access-control-allow-origin')}`
        }
      } catch (err) { cors = `check failed: ${err.message}` }
      console.log(`::notice title=QUL font CDN::${cors}`)
      console.log(`::notice title=Mushaf data::pages=${pages.length} lines=${pages.reduce((n, p) => n + p.length, 0)} words=${words.size} | vs Tanzil: ${diff}`)
    }
  } catch (e) {
    if (await exists(outPath)) {
      console.warn(`Mushaf: download failed (${e.message}); using the existing local copy.`)
      return
    }
    if (STRICT) {
      console.error(`${GH ? '::error title=Mushaf::' : ''}Mushaf: ${e.message}`)
      process.exit(1)
    }
    console.warn(`Mushaf: could not get the layout data (${e.message}). Building without the tajweed mushaf; the reader uses the plain text.`)
  }
}

await main()
