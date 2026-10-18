import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { db } from '../../lib/db'
import { addDays, longDate, weekdayName, type DayKey } from '../../lib/day'
import { useSelectedDay } from '../../lib/hooks'
import { useToday } from '../../lib/useToday'
import { DayNav, FutureNotice } from '../../components/DayNav'
import { SearchIcon } from '../../components/Icons'
import { Sheet } from '../../components/Sheet'
import { IconButton, TopBar } from '../../components/TopBar'
import { Card, Page, SectionLabel, TextInput } from '../../components/ui'

export const MOODS = [
  { value: 1, emoji: '😣', label: 'Awful', color: '#ef4444' },
  { value: 2, emoji: '😕', label: 'Bad', color: '#f97316' },
  { value: 3, emoji: '😐', label: 'Okay', color: '#eab308' },
  { value: 4, emoji: '🙂', label: 'Good', color: '#22c55e' },
  { value: 5, emoji: '😄', label: 'Great', color: '#10b981' },
]

export function Journal() {
  const today = useToday()
  const [day, setDay] = useSelectedDay(today)
  // Wrapped so "still loading" (undefined) differs from "no entry" ({ entry: undefined }).
  const loaded = useLiveQuery(async () => ({ day, entry: await db.journal.get(day) }), [day])
  const entry = loaded?.day === day ? loaded.entry : undefined
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6))
  const recent = useLiveQuery(() => db.journal.where('day').between(week[0], week[6], true, true).toArray(), [week[0]]) ?? []
  const [searching, setSearching] = useState(false)
  const future = day > today

  const setMood = (mood: number) =>
    db.transaction('rw', db.journal, async () => {
      const cur = await db.journal.get(day)
      await db.journal.put({ day, text: cur?.text ?? '', mood: cur?.mood === mood ? null : mood, updatedAt: Date.now() })
    })

  return (
    <>
      <TopBar title="Journal" backTo="/more" actions={
        <IconButton label="Search entries" onClick={() => setSearching(true)}><SearchIcon size={22} /></IconButton>
      } />
      <Page>
        <DayNav day={day} today={today} onChange={setDay} />
        {future && <FutureNotice />}

        <div className="stagger flex flex-col gap-3" key={day}>
          <Card>
            <p className="mb-3 text-[15px] font-semibold">How was {day === today ? 'today' : 'this day'}?</p>
            <div className="grid grid-cols-5 gap-2">
              {MOODS.map((m) => {
                const active = entry?.mood === m.value
                return (
                  <button key={m.value} type="button" disabled={future} onClick={() => setMood(m.value)} aria-pressed={active}
                    className={`pressable flex flex-col items-center gap-1 rounded-2xl py-2.5 transition-all duration-200 disabled:opacity-40 ${active ? '' : 'bg-surface-2'}`}
                    style={active ? { background: `color-mix(in srgb, ${m.color} 20%, transparent)`, boxShadow: `inset 0 0 0 2px ${m.color}` } : undefined}>
                    <span key={String(active)} className={`text-[30px] leading-none transition-transform ${active ? 'animate-pop scale-110' : entry?.mood ? 'opacity-50 grayscale-[0.4]' : ''}`}>{m.emoji}</span>
                    <span className="text-[11px] font-semibold text-muted">{m.label}</span>
                  </button>
                )
              })}
            </div>
          </Card>

          {!future && loaded?.day === day && <Editor key={day} day={day} initial={loaded.entry?.text ?? ''} />}

          <SectionLabel>Last 7 days</SectionLabel>
          <Card className="grid grid-cols-7 gap-1 py-3">
            {week.map((d) => {
              const e = recent.find((r) => r.day === d)
              const mood = MOODS.find((m) => m.value === e?.mood)
              return (
                <button key={d} type="button" onClick={() => setDay(d)} className="flex flex-col items-center gap-1">
                  <span className="text-[11px] font-semibold text-muted">{weekdayName(d).slice(0, 2)}</span>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full text-[18px] ${d === day ? 'ring-2 ring-accent' : ''}`}
                    style={{ background: mood ? `color-mix(in srgb, ${mood.color} 18%, transparent)` : 'var(--surface-2)' }}>
                    {mood?.emoji ?? (e?.text ? '·' : '')}
                  </span>
                </button>
              )
            })}
          </Card>
        </div>
      </Page>
      <SearchSheet open={searching} onClose={() => setSearching(false)} onPick={(d) => { setDay(d); setSearching(false) }} />
    </>
  )
}

/** Auto-saving text area (debounced, flushed on blur and when leaving the day). */
function Editor({ day, initial }: { day: DayKey; initial: string }) {
  const [text, setText] = useState(initial)
  const [saved, setSaved] = useState(true)
  const latest = useRef(initial)
  const lastSaved = useRef(initial)
  const area = useRef<HTMLTextAreaElement>(null)

  const flush = () => {
    const t = latest.current
    setSaved(true)
    if (t === lastSaved.current) return
    lastSaved.current = t
    // Re-read so a mood picked meanwhile isn't overwritten.
    db.transaction('rw', db.journal, async () => {
      const cur = await db.journal.get(day)
      await db.journal.put({ day, text: t, mood: cur?.mood ?? null, updatedAt: Date.now() })
    })
  }

  useEffect(() => {
    if (saved) return
    const timer = setTimeout(flush, 600)
    return () => clearTimeout(timer)
  }, [text, saved]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => flush(), []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = area.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(220, el.scrollHeight)}px`
  }, [text])

  return (
    <Card className="relative">
      <textarea ref={area} value={text} onChange={(e) => { setText(e.target.value); latest.current = e.target.value; setSaved(false) }} onBlur={flush}
        placeholder="Write about your day…"
        className="min-h-[220px] w-full resize-none bg-transparent text-[17px] leading-relaxed outline-none placeholder:text-faint" />
      <p className="text-right text-[12px] text-muted">{saved ? (text ? 'Saved' : '') : 'Saving…'}</p>
    </Card>
  )
}

function highlight(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0 || !q) return <>{text.slice(0, 140)}</>
  const start = Math.max(0, i - 50)
  return (
    <>
      {start > 0 && '…'}{text.slice(start, i)}
      <mark className="rounded bg-accent-soft px-0.5 text-accent">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length, i + q.length + 90)}…
    </>
  )
}

function SearchSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (d: DayKey) => void }) {
  const [q, setQ] = useState('')
  const all = useLiveQuery(() => (open ? db.journal.orderBy('day').reverse().toArray() : []), [open]) ?? []
  const query = q.trim().toLowerCase()
  const results = all.filter((e) => (query ? e.text.toLowerCase().includes(query) : e.text || e.mood)).slice(0, 60)

  return (
    <Sheet open={open} onClose={onClose} title="Search journal">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <SearchIcon size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entries" className="pl-11" autoFocus enterKeyHint="search" />
        </div>
        <div className="flex flex-col gap-2">
          {results.map((e) => {
            const mood = MOODS.find((m) => m.value === e.mood)
            return (
              <button key={e.day} type="button" onClick={() => onPick(e.day)} className="pressable rounded-2xl bg-surface-2 p-3.5 text-left">
                <span className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold">{weekdayName(e.day)}, {longDate(e.day)}</span>
                  {mood && <span className="text-[18px]">{mood.emoji}</span>}
                </span>
                {e.text && <span className="mt-1 block text-[14px] leading-snug text-muted">{highlight(e.text, q.trim())}</span>}
              </button>
            )
          })}
          {results.length === 0 && <p className="py-6 text-center text-[14px] text-muted">{query ? 'No entries match.' : 'No entries yet.'}</p>}
        </div>
      </div>
    </Sheet>
  )
}
