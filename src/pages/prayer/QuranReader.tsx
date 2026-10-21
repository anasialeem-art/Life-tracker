import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useBackClose } from '../../lib/backstack'
import { db, uid } from '../../lib/db'
import { todayKey } from '../../lib/day'
import {
  BASMALA_GLYPHS, COMMON_FAMILY, FRAME_GLYPH, FRAME_SHIFT_EM, HAS_MUSHAF, INK, LINE_HEIGHT_EM, REFERENCE_LINE_WIDTH, SURAH_NAMES_FAMILY,
  SURAH_NAME_SHIFT_EM, fontSizeForWidth, frameFontSize, loadMushafPages, loadPageFont, loadSharedFonts, pageFamily, paletteFor,
  quarterOf, surahNameGlyph, type MushafLine, type MushafTheme,
} from '../../lib/mushaf'
import {
  META, TOTAL_PAGES, arabicNumber, juzOfPage, loadQuran, pageAyat, splitBasmala, surahsOnPage, type QuranText,
} from '../../lib/quran'
import { setSetting, useSettings } from '../../lib/settings'
import { BookmarkIcon, CheckIcon, ChevronLeft, ChevronRight, XIcon } from '../../components/Icons'
import { useToast } from '../../components/ui'
import { logQuranPages } from './quranLog'

/** Seconds on a page before it counts as read. */
export const READ_AFTER_S = 15
const FONT_SIZES = [20, 23, 26, 30, 34, 38]

const useDark = () => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const obs = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

/**
 * Full-screen reader, one Madani page at a time, right to left. Shows the King Fahd tajweed mushaf
 * (15 printed lines) when its page font is available, else the Tanzil text. Swipe right for the
 * next page, like turning an Arabic book; tap to show or hide the controls.
 */
export function QuranReader({ initialPage, onClose }: { initialPage: number; onClose: () => void }) {
  const settings = useSettings()
  const dark = useDark()
  const theme: MushafTheme = dark ? 'dark' : 'light'
  const [page, setPage] = useState(initialPage)
  const [text, setText] = useState<QuranText | null | undefined>(undefined)
  const [mushaf, setMushaf] = useState<MushafLine[][] | null | undefined>(HAS_MUSHAF ? undefined : null)
  const [font, setFont] = useState<'loading' | 'ready' | 'failed'>('loading')
  // Surah-name and frame fonts; without them headers and the basmala are drawn in Amiri.
  const [shared, setShared] = useState(false)
  const [controls, setControls] = useState(true)
  const [counted, setCounted] = useState(false)
  const [toast, showToast] = useToast()
  const bookmark = useLiveQuery(() => db.quranBookmarks.where('page').equals(page).first(), [page])
  const today = todayKey()
  const readToday = useLiveQuery(() => db.quranReads.where('day').equals(today).count(), [today]) ?? 0
  const goal = settings?.quranDailyGoal ?? 0
  const fontSize = settings?.quranFontSize ?? 26
  const wantMushaf = (settings?.quranStyle ?? 'tajweed') === 'tajweed' && HAS_MUSHAF
  const scroller = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const gesture = useRef<{ x: number; y: number; t: number } | null>(null)

  useBackClose(true, onClose)
  useEffect(() => { loadQuran().then(setText) }, [])
  useEffect(() => { if (HAS_MUSHAF) loadMushafPages().then(setMushaf) }, [])

  // Controls fade out shortly after opening, so the page fills the screen.
  useEffect(() => {
    const t = setTimeout(() => setControls(false), 2500)
    return () => clearTimeout(t)
  }, [])

  // Lock page scroll and keep the screen on while reading.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock?.request('screen').then((l) => { lock = l }, () => {})
    return () => {
      document.body.style.overflow = prev
      lock?.release().catch(() => {})
    }
  }, [])

  useLayoutEffect(() => {
    const el = area.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Page font (downloaded once, then offline); neighbours are fetched ahead.
  useEffect(() => {
    if (!wantMushaf) return
    let live = true
    setFont('loading')
    loadPageFont(page).then(() => live && setFont('ready'), () => live && setFont('failed'))
    loadSharedFonts().then(() => live && setShared(true), () => {})
    for (const n of [page + 1, page - 1]) if (n >= 1 && n <= TOTAL_PAGES) loadPageFont(n).catch(() => {})
    return () => { live = false }
  }, [page, wantMushaf])

  // Remember the position; count the page as read after a while on it (only while the app is visible).
  useEffect(() => {
    setSetting('quranLastPage', page)
    setCounted(false)
    scroller.current?.scrollTo({ top: 0 })
    let elapsed = 0
    const tick = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      elapsed++
      if (elapsed === READ_AFTER_S) {
        setCounted(true)
        logQuranPages([page], 'reader').then((done) => done && showToast('Khatma complete! May Allah accept it.'))
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (p: number) => setPage(Math.min(TOTAL_PAGES, Math.max(1, p)))
  const toggleBookmark = () => (bookmark ? db.quranBookmarks.delete(bookmark.id) : db.quranBookmarks.add({ id: uid(), page, createdAt: Date.now() }))
  const zoom = (dir: 1 | -1) => {
    const i = FONT_SIZES.findIndex((s) => s >= fontSize)
    setSetting('quranFontSize', FONT_SIZES[Math.min(FONT_SIZES.length - 1, Math.max(0, (i < 0 ? 2 : i) + dir))])
  }

  const onDown = (e: PointerEvent) => { gesture.current = { x: e.clientX, y: e.clientY, t: Date.now() } }
  const onUp = (e: PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    const dx = e.clientX - g.x
    const dy = e.clientY - g.y
    if (Math.abs(dx) > 70 && Math.abs(dy) < 60) go(page + (dx > 0 ? 1 : -1))
    else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && Date.now() - g.t < 400) setControls((c) => !c)
  }

  const meta = META
  const lines = mushaf?.[page - 1]
  const showMushaf = wantMushaf && !!lines && font !== 'failed'
  // With the mushaf shown, describe the page by its own lines (this edition's page starts can differ by an ayah).
  const ownFirst = showMushaf ? lines!.find((l) => l[0] === 'a') as readonly ['a', 0 | 1, string, number, number] | undefined : undefined
  const suras = showMushaf ? [...new Set(lines!.flatMap((l) => (l[0] === 's' ? [l[1]] : l[0] === 'a' ? [l[3]] : [])))] : meta ? surahsOnPage(meta, page) : []
  const first = ownFirst ? { sura: ownFirst[3], aya: ownFirst[4] } : meta ? pageAyat(meta, page)[0] : null
  const juz = meta && first ? juzOfPage(meta, page, [first.sura, first.aya]) : null
  const quarter = meta?.quarters?.length && first ? quarterOf(meta.quarters, first.sura, first.aya) : null
  const bg = showMushaf ? (dark ? '#0e0e0f' : '#fffdf7') : 'var(--page)'
  const ink = showMushaf ? INK[theme] : 'var(--page-ink)'

  return createPortal(
    <div data-sec="prayer" className="fixed inset-0 z-50 flex flex-col select-none" style={{ background: bg, color: ink }} role="dialog" aria-modal="true" aria-label="Quran reader">
      {/* Running head, as in a printed mushaf */}
      <div className="mx-auto flex w-full max-w-xl shrink-0 items-center justify-between px-5 pt-[max(env(safe-area-inset-top),12px)] pb-1 text-[14px] opacity-80">
        <span className="truncate font-medium">{meta ? suras.map((s) => meta.suras[s - 1].tname).join(' · ') : ''}</span>
        <span className="flex shrink-0 items-center gap-3 font-medium tabular">
          {juz !== null && <span>Juz {juz}</span>}
          {quarter !== null && <span className="flex items-center gap-1"><HizbMark part={quarter % 4} /> Hizb {Math.floor(quarter / 4) + 1}</span>}
        </span>
      </div>

      <div ref={area} className="relative min-h-0 flex-1" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (gesture.current = null)}>
        {showMushaf && lines ? (
          <div key={page} className="animate-fade-in absolute inset-0 flex items-center justify-center px-3">
            {font === 'ready' && box.w > 0 ? (
              <MushafPage page={page} lines={lines} theme={theme} width={box.w - 24} height={box.h - 8} ink={ink} shared={shared} text={text ?? null} />
            ) : (
              <p className="text-[14px] opacity-60">Loading page…</p>
            )}
          </div>
        ) : (
          <div ref={scroller} className="absolute inset-0 overflow-y-auto overscroll-contain">
            <div key={page} className="animate-fade-in mx-auto max-w-xl px-5 py-4">
              {wantMushaf && font === 'failed' && (
                <p className="mb-3 rounded-xl bg-surface-2/70 px-3 py-2 text-center text-[12px] text-muted">This mushaf page isn’t downloaded yet, so it’s shown as plain text. It downloads next time you’re online.</p>
              )}
              {text === undefined && <p className="py-20 text-center text-[15px] text-muted">Loading…</p>}
              {(text === null || !meta) && text !== undefined && <p className="py-20 text-center text-[15px] text-muted">The Quran text isn’t included in this build of the app.</p>}
              {text && meta && <PageText text={text} page={page} fontSize={fontSize} />}
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 pb-[max(env(safe-area-inset-bottom),10px)] text-center text-[14px] font-medium opacity-80 tabular">{page}</div>

      {/* Controls, shown on tap */}
      <div className={`pointer-events-none absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${controls ? 'opacity-100' : 'opacity-0'}`}>
        <div className={`${controls ? 'pointer-events-auto' : ''} border-b border-line bg-surface/95 pt-safe text-text backdrop-blur-xl`}>
          <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-2">
            <button type="button" onClick={onClose} aria-label="Close reader" className="pressable flex h-10 w-10 items-center justify-center rounded-full text-muted"><XIcon size={22} /></button>
            <div className="min-w-0 flex-1 text-center">
              {meta && <p dir="rtl" lang="ar" className="font-quran truncate text-[19px] leading-tight">{suras.map((s) => `سورة ${meta.suras[s - 1].name}`).join(' · ')}</p>}
              <p className="text-[12px] text-muted tabular">Juz {juz ?? '–'} · Page {page} of {TOTAL_PAGES}</p>
            </div>
            <button type="button" onClick={toggleBookmark} aria-label={bookmark ? 'Remove bookmark' : 'Bookmark this page'} aria-pressed={!!bookmark}
              className={`pressable flex h-10 w-10 items-center justify-center rounded-full ${bookmark ? 'text-accent' : 'text-muted'}`}>
              <BookmarkIcon size={22} filled={!!bookmark} />
            </button>
          </div>
        </div>
        <div className={`${controls ? 'pointer-events-auto' : ''} border-t border-line bg-surface/95 pb-safe text-text backdrop-blur-xl`}>
          <div className="mx-auto flex h-16 max-w-xl items-center gap-2 px-3">
            <button type="button" onClick={() => go(page + 1)} disabled={page >= TOTAL_PAGES} aria-label="Next page"
              className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-accent disabled:opacity-30"><ChevronLeft size={22} /></button>
            {!showMushaf && <button type="button" onClick={() => zoom(-1)} aria-label="Smaller text" className="pressable h-11 w-11 rounded-full text-[15px] font-semibold text-muted">A−</button>}
            <div className="flex min-w-0 flex-1 flex-col items-center">
              <span className={`flex items-center gap-1 text-[13px] font-semibold tabular ${goal && readToday >= goal ? 'text-success' : 'text-muted'}`}>
                {counted && <CheckIcon size={14} strokeWidth={3} className="animate-pop text-success" />}
                {readToday}{goal ? ` / ${goal}` : ''} pages today
              </span>
              <span className="text-[11px] text-faint">{counted ? 'Page counted' : `Counts after ${READ_AFTER_S}s`}</span>
            </div>
            {!showMushaf && <button type="button" onClick={() => zoom(1)} aria-label="Larger text" className="pressable h-11 w-11 rounded-full text-[18px] font-semibold text-muted">A+</button>}
            <button type="button" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page"
              className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-accent disabled:opacity-30"><ChevronRight size={22} /></button>
          </div>
        </div>
      </div>
      {toast}
    </div>,
    document.body,
  )
}

/** Quarter marker for the hizb (empty at its start, then ¼, ½, ¾ filled). */
function HizbMark({ part }: { part: number }) {
  const r = 6
  const angle = (part / 4) * 2 * Math.PI
  const x = 7 + r * Math.sin(angle)
  const y = 7 - r * Math.cos(angle)
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <circle cx="7" cy="7" r={r} fill="none" stroke="currentColor" strokeWidth="1.4" />
      {part > 0 && <path d={`M7 7 L7 1 A${r} ${r} 0 ${part > 2 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`} fill="currentColor" />}
    </svg>
  )
}

// ---- Mushaf page ----------------------------------------------------------------------------

const pinned: CSSProperties = {
  whiteSpace: 'nowrap', fontWeight: 400, fontStyle: 'normal', fontSynthesis: 'none', fontFeatureSettings: 'normal',
  letterSpacing: 0, wordSpacing: 0, textTransform: 'none', textIndent: 0,
}

/**
 * One printed page: the type size is the largest at which 15 lines fit the box; every full line is
 * then scaled to fill the measure exactly (the font's own word spacing is never stretched).
 */
function MushafPage({ page, lines, theme, width, height, ink, shared, text }: {
  page: number
  lines: MushafLine[]
  theme: MushafTheme
  width: number
  height: number
  ink: string
  /** Surah-name/frame fonts loaded; otherwise headers fall back to Amiri. */
  shared: boolean
  text: QuranText | null
}) {
  const fs = Math.max(8, Math.min(fontSizeForWidth(width), height / (15 * LINE_HEIGHT_EM)))
  const lineH = fs * LINE_HEIGHT_EM
  const measure = (fs * REFERENCE_LINE_WIDTH) / 2500
  const palette = paletteFor(page, theme)
  return (
    <div dir="rtl" lang="ar" style={{ width: measure, color: ink }} aria-label={`Page ${page}`}>
      {lines.map((l, i) => (
        <div key={i} className="relative" style={{ height: lineH }}>
          {l[0] === 'a' ? (
            <AyahLine text={l[2]} centered={l[1] === 1} fs={fs} lineH={lineH} measure={measure} family={pageFamily(page)} palette={palette} />
          ) : l[0] === 's' && !shared ? (
            <span className="font-quran absolute inset-x-[6%] inset-y-[14%] flex items-center justify-center rounded-full border-2 border-current/40" style={{ fontSize: fs * 1.05 }}>
              سورة {META?.suras[l[1] - 1].name}
            </span>
          ) : l[0] === 'b' && !shared ? (
            <span className="font-quran absolute inset-0 flex items-center justify-center" style={{ fontSize: fs * 1.1 }}>{text?.ayat[0][0]}</span>
          ) : l[0] === 's' ? (
            <>
              <Glyph family={COMMON_FAMILY} size={frameFontSize(fs)} lineH={lineH} shift={FRAME_SHIFT_EM}>{FRAME_GLYPH}</Glyph>
              <Glyph family={SURAH_NAMES_FAMILY} size={fs} lineH={lineH} shift={SURAH_NAME_SHIFT_EM}>{surahNameGlyph(l[1])}</Glyph>
            </>
          ) : (
            <Glyph family={SURAH_NAMES_FAMILY} size={fs} lineH={lineH} shift={0}>{BASMALA_GLYPHS}</Glyph>
          )}
        </div>
      ))}
    </div>
  )
}

function Glyph({ family, size, lineH, shift, children }: { family: string; size: number; lineH: number; shift: number; children: ReactNode }) {
  return (
    <span className="absolute inset-0 block text-center" style={{
      ...pinned, fontFamily: `"${family}"`, fontSize: size, lineHeight: `${lineH}px`, direction: 'rtl',
      transform: shift ? `translateY(${shift}em)` : undefined,
    }}>{children}</span>
  )
}

function AyahLine({ text, centered, fs, lineH, measure, family, palette }: {
  text: string
  centered: boolean
  fs: number
  lineH: number
  measure: number
  family: string
  palette: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.fontSize = `${fs}px`
    const natural = el.getBoundingClientRect().width
    el.style.fontSize = `${centered || natural <= 0 ? fs : (fs * measure) / natural}px`
    setReady(true)
  }, [text, fs, measure, centered])
  return (
    <div className="absolute inset-0 flex" style={{ justifyContent: centered ? 'center' : 'flex-start', direction: 'rtl' }}>
      <span ref={ref} style={{
        ...pinned, display: 'inline-block', fontFamily: `"${family}"`, fontSize: fs, lineHeight: `${lineH}px`, fontKerning: 'none',
        ['fontPalette' as string]: palette, visibility: ready ? 'visible' : 'hidden',
      }}>{text}</span>
    </div>
  )
}

// ---- Plain text page (Tanzil) ------------------------------------------------------------------

/** One page: surah headers, the basmala on its own line, and the ayat with end markers. */
function PageText({ text, page, fontSize }: { text: QuranText; page: number; fontSize: number }) {
  const meta = META!
  const blocks: ReactNode[] = []
  let run: ReactNode[] = []
  const flush = () => {
    if (run.length) blocks.push(<p key={`p${blocks.length}`} className="text-justify">{run}</p>)
    run = []
  }
  for (const { sura, aya } of pageAyat(meta, page)) {
    const { basmala, rest } = splitBasmala(text, sura, aya)
    if (aya === 1) {
      flush()
      blocks.push(
        <div key={`h${sura}`} className="my-4 flex items-center justify-center rounded-2xl border border-accent/30 bg-accent-soft py-2">
          <span className="text-[0.85em] text-accent">سورة {meta.suras[sura - 1].name}</span>
        </div>,
      )
      if (basmala) blocks.push(<p key={`b${sura}`} className="mb-2 text-center">{basmala}</p>)
    }
    run.push(
      <span key={`${sura}:${aya}`}>
        {rest}
        <span className="mx-1 inline-flex h-[1.45em] min-w-[1.45em] items-center justify-center rounded-full border border-accent/45 px-1 align-middle text-[0.55em] leading-none text-accent">
          {arabicNumber(aya)}
        </span>{' '}
      </span>,
    )
  }
  flush()
  return (
    <div dir="rtl" lang="ar" className="font-quran" style={{ fontSize, lineHeight: 2.15 }}>{blocks}</div>
  )
}
