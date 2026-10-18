import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { db, uid } from '../../lib/db'
import type { DayKey } from '../../lib/day'
import { parseLyftaCsv, personalRecords, shortDate, weeklyVolume } from '../../lib/fitness'
import { BarChart } from '../../components/Charts'
import { ChartIcon, TrophyIcon, UploadIcon } from '../../components/Icons'
import { Button, Card } from '../../components/ui'

const fmtVol = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString('en-GB', { maximumFractionDigits: 1 })}t` : `${Math.round(v)}kg`)

export function LyftaStats({ today }: { today: DayKey }) {
  const sets = useLiveQuery(() => db.lyftaSets.toArray()) ?? []
  const input = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)
  const [showAll, setShowAll] = useState(false)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = parseLyftaCsv(await file.text())
      await db.transaction('rw', db.lyftaSets, async () => {
        await db.lyftaSets.clear()
        await db.lyftaSets.bulkAdd(parsed.map((s) => ({ ...s, id: uid() })))
      })
      setMsg({ text: `Imported ${parsed.length.toLocaleString('en-GB')} sets.` })
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true })
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  const volume = weeklyVolume(sets, 8, today)
  const prs = personalRecords(sets)
  const last = sets.reduce<DayKey | null>((m, s) => (!m || s.day > m ? s.day : m), null)

  return (
    <Card>
      {sets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent"><ChartIcon size={26} /></span>
          <p className="text-[16px] font-semibold">Lyfta stats</p>
          <p className="max-w-64 text-[14px] text-muted">In Lyfta, export your workouts as CSV, then load the file here for weekly volume and PRs.</p>
          <Button small className="mt-2" onClick={() => input.current?.click()}><UploadIcon size={17} /> Load CSV</Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-accent">Weekly volume</p>
              <p className="text-[13px] text-muted">{sets.length.toLocaleString('en-GB')} sets · last workout {last ? shortDate(last) : '—'}</p>
            </div>
            <Button small variant="secondary" onClick={() => input.current?.click()}><UploadIcon size={16} /> Update</Button>
          </div>
          <div className="mt-4">
            <BarChart bars={volume.map((w) => ({ label: `${+w.week.slice(8)}/${+w.week.slice(5, 7)}`, value: w.volume }))} format={fmtVol} />
          </div>
          <p className="mt-5 mb-1 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted"><TrophyIcon size={16} /> Personal records</p>
          <div className="divide-y divide-line">
            {(showAll ? prs : prs.slice(0, 6)).map((p) => (
              <div key={p.exercise} className="flex min-h-12 items-center gap-3 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{p.exercise}</span>
                  <span className="block text-[12px] text-muted">{shortDate(p.day)} · est. 1RM {Math.round(p.e1rm)} kg</span>
                </span>
                <span className="text-[16px] font-bold tabular">{p.weight.toLocaleString('en-GB')} kg <span className="text-[13px] font-medium text-muted">× {p.reps}</span></span>
              </div>
            ))}
          </div>
          {prs.length > 6 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="mt-1 w-full py-2 text-[14px] font-semibold text-accent">
              {showAll ? 'Show fewer' : `Show all ${prs.length}`}
            </button>
          )}
        </>
      )}
      {msg && <p className={`mt-2 text-center text-[13px] font-medium ${msg.error ? 'text-danger' : 'text-success'}`}>{msg.text}</p>}
      <input ref={input} type="file" accept=".csv,text/csv,text/comma-separated-values" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
    </Card>
  )
}
