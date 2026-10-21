import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useBackClose } from '../../lib/backstack'
import { db, uid } from '../../lib/db'
import { todayKey } from '../../lib/day'
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

/**
 * Full-screen mushaf-style reader: one Madani page at a time, right to left.
 * Swipe right (or tap the left arrow) for the next page, like turning an Arabic book.
 */
export function QuranReader({ initialPage, onClose }: { initialPage: number; onClose: () => void }) {
  const settings = useSettings()
  const [page, setPage] = useState(initialPage)
  const [text, setText] = useState<QuranText | null | undefined>(undefined)
  const [counted, setCounted] = useState(false)
  const [toast, showToast] = useToast()
  const bookmark = useLiveQuery(() => db.quranBookmarks.where('page').equals(page).first(), [page])
  const today = todayKey()
  const readToday = useLiveQuery(() => db.quranReads.where('day').equals(today).count(), [today]) ?? 0
  const goal = settings?.quranDailyGoal ?? 0
  const fontSize = settings?.quranFontSize ?? 26
  const scroller = useRef<HTMLDivElement>(null)
  const swipe = useRef<{ x: number; y: number } | null>(null)

  useBackClose(true, onClose)
  useEffect(() => { loadQuran().then(setText) }, [])

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

  const onDown = (e: PointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY } }
  const onUp = (e: PointerEvent) => {
    const s = swipe.current
    swipe.current = null
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 70 && Math.abs(dy) < 60) go(page + (dx > 0 ? 1 : -1))
  }

  const meta = META
  const suras = meta ? surahsOnPage(meta, page) : []

  return createPortal(
    <div data-sec="prayer" className="fixed inset-0 z-50 flex flex-col bg-[var(--page)] text-[var(--page-ink)]" role="dialog" aria-modal="true" aria-label="Quran reader">
      <header className="shrink-0 border-b border-line pt-safe">
        <div className="mx-auto flex h-14 max-w-xl items-center gap-2 px-2">
          <button type="button" onClick={onClose} aria-label="Close reader" className="pressable flex h-10 w-10 items-center justify-center rounded-full text-muted"><XIcon size={22} /></button>
          <div className="min-w-0 flex-1 text-center">
            {meta && <p dir="rtl" lang="ar" className="font-quran truncate text-[19px] leading-tight">{suras.map((s) => `سورة ${meta.suras[s - 1].name}`).join(' · ')}</p>}
            <p className="text-[12px] text-muted tabular">Juz {meta ? juzOfPage(meta, page) : '–'} · Page {page}</p>
          </div>
          <button type="button" onClick={toggleBookmark} aria-label={bookmark ? 'Remove bookmark' : 'Bookmark this page'} aria-pressed={!!bookmark}
            className={`pressable flex h-10 w-10 items-center justify-center rounded-full ${bookmark ? 'text-accent' : 'text-muted'}`}>
            <BookmarkIcon size={22} filled={!!bookmark} />
          </button>
        </div>
      </header>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)}>
        <div key={page} className="animate-fade-in mx-auto max-w-xl px-5 py-6">
          {text === undefined && <p className="py-20 text-center text-[15px] text-muted">Loading…</p>}
          {(text === null || !meta) && text !== undefined && (
            <p className="py-20 text-center text-[15px] text-muted">The Quran text isn’t included in this build of the app.</p>
          )}
          {text && meta && <PageText text={text} page={page} fontSize={fontSize} />}
          <p className="pt-6 text-center text-[13px] text-muted tabular">{arabicNumber(page)}</p>
        </div>
      </div>

      <footer className="shrink-0 border-t border-line pb-safe">
        <div className="mx-auto flex h-16 max-w-xl items-center gap-2 px-3">
          <button type="button" onClick={() => go(page + 1)} disabled={page >= TOTAL_PAGES} aria-label="Next page"
            className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-accent disabled:opacity-30"><ChevronLeft size={22} /></button>
          <button type="button" onClick={() => zoom(-1)} aria-label="Smaller text" className="pressable h-11 w-11 rounded-full text-[15px] font-semibold text-muted">A−</button>
          <div className="flex min-w-0 flex-1 flex-col items-center">
            <span className={`flex items-center gap-1 text-[13px] font-semibold tabular ${goal && readToday >= goal ? 'text-success' : 'text-muted'}`}>
              {counted && <CheckIcon size={14} strokeWidth={3} className="animate-pop text-success" />}
              {readToday}{goal ? ` / ${goal}` : ''} pages today
            </span>
            <span className="text-[11px] text-faint">{counted ? 'Page counted' : `Counts after ${READ_AFTER_S}s`}</span>
          </div>
          <button type="button" onClick={() => zoom(1)} aria-label="Larger text" className="pressable h-11 w-11 rounded-full text-[18px] font-semibold text-muted">A+</button>
          <button type="button" onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page"
            className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-accent disabled:opacity-30"><ChevronRight size={22} /></button>
        </div>
      </footer>
      {toast}
    </div>,
    document.body,
  )
}

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
