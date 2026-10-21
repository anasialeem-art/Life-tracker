import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../lib/db'
import { todayKey } from '../../lib/day'
import {
  META, TOTAL_PAGES, juzOfPage, juzStartPage, khatmaPages, nextUnreadPage, surahStartPage, surahsOnPage,
} from '../../lib/quran'
import { useSettings } from '../../lib/settings'
import { BookmarkIcon, ChevronRight, PlusIcon, QuranIcon, TrophyIcon, XIcon } from '../../components/Icons'
import { Sheet, SheetAction } from '../../components/Sheet'
import { Button, Card, EmptyState, Field, Page, ProgressBar, Ring, SectionLabel, Segmented, Stepper, TextInput, useToast } from '../../components/ui'
import { logQuranPages } from './quranLog'
import { QuranReader } from './QuranReader'

type Browse = 'surah' | 'juz' | 'page'

export function QuranSection() {
  const settings = useSettings()
  const [reader, setReader] = useState<number | null>(null)
  const [browse, setBrowse] = useState<Browse>('surah')
  const [logOpen, setLogOpen] = useState(false)
  const [toast, showToast] = useToast()
  const today = todayKey()
  const todayCount = useLiveQuery(() => db.quranReads.where('day').equals(today).count(), [today]) ?? 0
  const start = settings?.quranKhatmaStart ?? 0
  const khatmaReads = useLiveQuery(() => db.quranReads.where('at').aboveOrEqual(start).toArray(), [start]) ?? []
  const bookmarks = useLiveQuery(() => db.quranBookmarks.orderBy('page').toArray()) ?? []

  if (!settings) return null
  const meta = META
  if (!meta) {
    return (
      <Page>
        <Card><EmptyState icon={<QuranIcon size={28} />} title="Quran text not included">This build of the app was made without the Tanzil Quran data.</EmptyState></Card>
      </Page>
    )
  }

  const last = settings.quranLastPage
  const lastSura = meta.suras[surahsOnPage(meta, last)[0] - 1]
  const pages = khatmaPages(khatmaReads, settings.quranKhatmaStart)
  const goal = settings.quranDailyGoal
  const pct = Math.round((pages.size / TOTAL_PAGES) * 100)

  return (
    <Page>
      <div className="stagger flex flex-col gap-3">
        <button type="button" onClick={() => setReader(last)}
          className="pressable relative overflow-hidden rounded-[26px] p-5 text-left text-white shadow-[0_12px_32px_-14px_#0f766e]"
          style={{ background: 'linear-gradient(135deg, #064e3b 0%, #0f766e 55%, #14b8a6 100%)' }}>
          <div className="pointer-events-none absolute -top-12 -right-10 h-44 w-44 rounded-full bg-white/10" />
          <p className="relative text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">Continue reading</p>
          <div className="relative mt-1 flex items-end justify-between gap-3">
            <div>
              <p className="text-[24px] leading-tight font-bold">{lastSura.tname}</p>
              <p className="text-[14px] text-white/80 tabular">Page {last} · Juz {juzOfPage(meta, last)}</p>
            </div>
            <p dir="rtl" lang="ar" className="font-quran text-[30px] leading-none">{lastSura.name}</p>
          </div>
          <span className="relative mt-4 inline-flex rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-[#064e3b]">Open reader</span>
        </button>

        <Card>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-accent">Today</p>
              <p className="text-[26px] leading-tight font-bold tabular">{todayCount}<span className="text-[15px] font-medium text-muted"> / {goal} pages</span></p>
            </div>
            <Button small variant="tinted" onClick={() => setLogOpen(true)}><PlusIcon size={17} /> Log pages</Button>
          </div>
          <div className="mt-3"><ProgressBar value={todayCount} max={goal} color={todayCount >= goal ? 'var(--success)' : undefined} height={12} /></div>
          <p className="mt-2 text-[13px] text-muted">{todayCount >= goal ? 'Daily goal reached. ما شاء الله' : `${goal - todayCount} more to reach today’s goal`}</p>
        </Card>

        <Card className="flex items-center gap-4">
          <Ring value={pages.size} max={TOTAL_PAGES} size={70} stroke={8}><span className="text-[15px] font-bold tabular">{pct}%</span></Ring>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-accent">Khatma</p>
            <p className="text-[18px] font-semibold tabular">{pages.size} of {TOTAL_PAGES} pages</p>
            <p className="text-[13px] text-muted">Next unread: page {nextUnreadPage(pages)}</p>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-warning-soft px-3 py-2">
            <TrophyIcon size={20} className="text-warning" />
            <span className="text-[20px] leading-tight font-bold tabular">{settings.quranKhatmasCompleted}</span>
            <span className="text-[11px] text-muted">completed</span>
          </div>
        </Card>

        {bookmarks.length > 0 && (
          <>
            <SectionLabel>Bookmarks</SectionLabel>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {bookmarks.map((b) => {
                const s = meta.suras[surahsOnPage(meta, b.page)[0] - 1]
                return (
                  <button key={b.id} type="button" onClick={() => setReader(b.page)}
                    className="pressable flex shrink-0 items-center gap-2.5 rounded-2xl bg-surface px-3.5 py-2.5 text-left shadow-card">
                    <BookmarkIcon size={18} filled className="text-accent" />
                    <span>
                      <span className="block text-[14px] font-semibold">{s.tname}</span>
                      <span className="block text-[12px] text-muted tabular">Page {b.page}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        <SectionLabel>Go to</SectionLabel>
        <Segmented value={browse} onChange={setBrowse} options={[{ value: 'surah', label: 'Surah' }, { value: 'juz', label: 'Juz' }, { value: 'page', label: 'Page' }]} />
        <div key={browse} className="animate-page-in">
          {browse === 'surah' && (
            <div className="rounded-[22px] bg-surface px-2 py-1 shadow-card">
              {meta.suras.map((s) => (
                <button key={s.n} type="button" onClick={() => setReader(surahStartPage(meta, s.n))}
                  className="flex min-h-[60px] w-full items-center gap-3 rounded-2xl px-2 text-left active:bg-surface-2">
                  <span className="flex h-9 w-9 shrink-0 rotate-45 items-center justify-center rounded-[10px] bg-accent-soft">
                    <span className="-rotate-45 text-[13px] font-bold text-accent tabular">{s.n}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-semibold">{s.tname}</span>
                    <span className="block truncate text-[12px] text-muted">{s.ename} · {s.ayas} ayat · p. {surahStartPage(meta, s.n)}</span>
                  </span>
                  <span dir="rtl" lang="ar" className="font-quran text-[22px] leading-none">{s.name}</span>
                </button>
              ))}
            </div>
          )}
          {browse === 'juz' && (
            <div className="rounded-[22px] bg-surface px-2 py-1 shadow-card">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((j) => {
                const [s, a] = meta.juz[j - 1]
                const p = juzStartPage(meta, j)
                return (
                  <button key={j} type="button" onClick={() => setReader(p)}
                    className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-2 text-left active:bg-surface-2">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[14px] font-bold text-accent tabular">{j}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-semibold">Juz {j}</span>
                      <span className="block text-[12px] text-muted">Starts {meta.suras[s - 1].tname} {s}:{a}</span>
                    </span>
                    <span className="text-[13px] text-muted tabular">p. {p}</span>
                    <ChevronRight size={16} className="text-faint" />
                  </button>
                )
              })}
            </div>
          )}
          {browse === 'page' && <PageJump onGo={setReader} />}
        </div>
        <p className="px-4 pt-1 text-center text-[12px] text-muted">Quran text: Tanzil.net (Uthmani). A page counts as read after 15 seconds on it in the reader.</p>
      </div>

      <LogPagesSheet open={logOpen} onClose={() => setLogOpen(false)} from={nextUnreadPage(pages)} goal={goal}
        onLogged={(done) => showToast(done ? 'Khatma complete! May Allah accept it.' : 'Pages logged')} />
      {reader !== null && <QuranReader initialPage={reader} onClose={() => setReader(null)} />}
      {toast}
    </Page>
  )
}

function PageJump({ onGo }: { onGo: (p: number) => void }) {
  const [value, setValue] = useState('')
  const n = parseInt(value, 10)
  const ok = n >= 1 && n <= TOTAL_PAGES
  return (
    <Card>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (ok) onGo(n) }}>
        <TextInput inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} placeholder="Page 1–604" aria-label="Page number" />
        <Button type="submit" disabled={!ok} className="shrink-0">Open</Button>
      </form>
    </Card>
  )
}

/** Manual entry for reading from a physical mushaf: a starting page and how many pages. */
function LogPagesSheet({ open, onClose, from, goal, onLogged }: { open: boolean; onClose: () => void; from: number; goal: number; onLogged: (khatmaDone: boolean) => void }) {
  const [start, setStart] = useState(String(from))
  const [count, setCount] = useState(goal || 1)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) { setStart(String(from)); setCount(goal || 1) }
  }
  const s = parseInt(start, 10)
  const valid = s >= 1 && s <= TOTAL_PAGES
  const pages = valid ? Array.from({ length: count }, (_, i) => ((s - 1 + i) % TOTAL_PAGES) + 1) : []
  const meta = META

  const save = async () => {
    if (!valid) return
    const done = await logQuranPages(pages, 'manual')
    onLogged(done)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log pages" action={<SheetAction onClick={save} disabled={!valid}>Log</SheetAction>}>
      <div className="flex flex-col gap-5">
        <p className="text-[14px] leading-snug text-muted">For reading from a printed mushaf. Pages you read in the app’s reader are logged automatically.</p>
        <Field label="From page">
          <div className="relative">
            <TextInput inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value.replace(/\D/g, ''))} />
            {start && <button type="button" aria-label="Clear" onClick={() => setStart('')} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted"><XIcon size={18} /></button>}
          </div>
        </Field>
        <div className="flex items-center justify-between">
          <span className="text-[16px]">Number of pages</span>
          <Stepper value={count} min={1} max={60} onChange={setCount} />
        </div>
        {valid && meta && (
          <p className="rounded-2xl bg-accent-soft px-4 py-3 text-center text-[15px] font-semibold text-accent tabular">
            Pages {pages[0]}–{pages.at(-1)} · {meta.suras[surahsOnPage(meta, pages[0])[0] - 1].tname}
          </p>
        )}
      </div>
    </Sheet>
  )
}
