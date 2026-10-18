import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../lib/db'
import { addDays, daysBetween, type DayKey } from '../../lib/day'
import { shortDate } from '../../lib/fitness'
import { LineChart } from '../../components/Charts'
import { ScaleIcon } from '../../components/Icons'
import { Card, Segmented } from '../../components/ui'

type Range = 'week' | 'month' | 'all'

const fmtKg = (n: number) => n.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function BodyweightCard({ day, locked }: { day: DayKey; locked: boolean }) {
  const all = useLiveQuery(() => db.bodyWeights.orderBy('day').toArray()) ?? []
  const entry = all.find((w) => w.day === day)
  const [value, setValue] = useState('')
  const [range, setRange] = useState<Range>('month')

  useEffect(() => setValue(entry ? String(entry.kg).replace('.', ',') : ''), [entry, day])

  const parsed = parseFloat(value.replace(',', '.'))
  const valid = Number.isFinite(parsed) && parsed > 20 && parsed < 400
  const save = () => valid && db.bodyWeights.put({ day, kg: Math.round(parsed * 10) / 10 })

  const from = range === 'week' ? addDays(day, -6) : range === 'month' ? addDays(day, -29) : '0000'
  const shown = all.filter((w) => w.day >= from && w.day <= day)
  const prev = [...all].reverse().find((w) => w.day < day)
  const delta = entry && prev ? entry.kg - prev.kg : null
  const first = shown[0]

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-accent">Bodyweight</p>
          <p className="text-[30px] leading-tight font-bold tabular">
            {entry ? fmtKg(entry.kg) : '—'}<span className="text-[16px] font-medium text-muted"> kg</span>
          </p>
          {delta !== null && (
            <p className={`text-[13px] font-semibold ${delta === 0 ? 'text-muted' : 'text-text'}`}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '='} {fmtKg(Math.abs(delta))} kg since {shortDate(prev!.day)}
            </p>
          )}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); save() }} className="flex items-center gap-1.5 rounded-2xl bg-surface-2 p-1.5">
          <ScaleIcon size={18} className="ml-1.5 text-muted" />
          <input value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="kg" disabled={locked}
            aria-label="Bodyweight in kg" className="h-10 w-16 bg-transparent text-center text-[17px] font-semibold outline-none tabular placeholder:font-normal placeholder:text-faint" />
          <button type="submit" disabled={!valid || locked || (entry && Math.abs(entry.kg - parsed) < 0.05)}
            className="pressable h-10 rounded-xl bg-accent px-3 text-[14px] font-semibold text-white disabled:opacity-30">Save</button>
        </form>
      </div>

      {shown.length > 0 ? (
        <div className="mt-4">
          <LineChart points={shown.map((w) => ({ x: daysBetween(shown[0].day, w.day), y: w.kg, label: shortDate(w.day) }))} format={fmtKg} />
          <div className="mt-3"><Segmented size="sm" value={range} onChange={setRange} options={[
            { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'all', label: 'All' },
          ]} /></div>
          {first && shown.length > 1 && (
            <p className="mt-2 text-center text-[12px] text-muted">
              {shown.length} weigh-ins · {(shown.at(-1)!.kg - first.kg) >= 0 ? '+' : '−'}{fmtKg(Math.abs(shown.at(-1)!.kg - first.kg))} kg over this range
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[14px] text-muted">Log your weight to see the trend.</p>
      )}
    </Card>
  )
}
