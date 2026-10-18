import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, uid, type NutritionEntry } from '../../lib/db'
import type { DayKey } from '../../lib/day'
import { momentOn } from '../../lib/hooks'
import { fmtTime } from '../../lib/prayer'
import { ChevronDown, FlameIcon, UndoIcon, XIcon } from '../../components/Icons'
import { Sheet, SheetAction } from '../../components/Sheet'
import { Card, Field, ProgressBar, TextInput } from '../../components/ui'

const QUICK: Record<NutritionEntry['kind'], number[]> = { kcal: [100, 250, 500], protein: [10, 20, 30] }
const META = {
  kcal: { label: 'Calories', unit: 'kcal', color: 'var(--c-kcal)' },
  protein: { label: 'Protein', unit: 'g', color: 'var(--c-protein)' },
}

export function NutritionCard({ day, today, locked, kcalTarget, proteinTarget }: {
  day: DayKey
  today: DayKey
  locked: boolean
  kcalTarget: number
  proteinTarget: number
}) {
  const entries = useLiveQuery(() => db.nutrition.where('day').equals(day).toArray(), [day]) ?? []
  const [custom, setCustom] = useState<NutritionEntry['kind'] | null>(null)
  const [value, setValue] = useState('')
  const [showLog, setShowLog] = useState(false)

  const add = (kind: NutritionEntry['kind'], amount: number) => {
    if (!amount || locked) return
    db.nutrition.add({ id: uid(), day, kind, amount, at: momentOn(day, today) })
  }
  const sorted = [...entries].sort((a, b) => b.at - a.at)
  const total = (k: NutritionEntry['kind']) => entries.filter((e) => e.kind === k).reduce((n, e) => n + e.amount, 0)
  const targets = { kcal: kcalTarget, protein: proteinTarget }

  return (
    <Card>
      <div className="flex flex-col gap-5">
        {(['kcal', 'protein'] as const).map((kind) => {
          const m = META[kind]
          const t = total(kind)
          const left = targets[kind] - t
          return (
            <div key={kind}>
              <div className="mb-2 flex items-end justify-between">
                <div>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.06em]" style={{ color: m.color }}>{m.label}</p>
                  <p className="text-[26px] leading-tight font-bold tabular">
                    {t.toLocaleString('en-GB')}<span className="text-[15px] font-medium text-muted"> / {targets[kind].toLocaleString('en-GB')} {m.unit}</span>
                  </p>
                </div>
                <p className={`pb-1 text-[13px] font-medium ${left < 0 ? 'text-warning' : 'text-muted'}`}>
                  {left >= 0 ? `${left.toLocaleString('en-GB')} left` : `${(-left).toLocaleString('en-GB')} over`}
                </p>
              </div>
              <ProgressBar value={t} max={targets[kind]} color={m.color} height={12} />
              <div className="mt-3 grid grid-cols-4 gap-2">
                {QUICK[kind].map((n) => (
                  <button key={n} type="button" disabled={locked} onClick={() => add(kind, n)}
                    className="pressable min-h-11 rounded-[14px] text-[15px] font-semibold tabular disabled:opacity-40"
                    style={{ background: `color-mix(in srgb, ${m.color} 14%, transparent)`, color: m.color }}>+{n}</button>
                ))}
                <button type="button" disabled={locked} onClick={() => { setValue(''); setCustom(kind) }}
                  className="pressable min-h-11 rounded-[14px] bg-surface-2 text-[15px] font-semibold disabled:opacity-40">Other</button>
              </div>
            </div>
          )
        })}

        {sorted.length > 0 && (
          <div className="border-t border-line pt-3">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => setShowLog(!showLog)} className="flex items-center gap-1 text-[14px] font-semibold text-muted">
                {sorted.length} entr{sorted.length === 1 ? 'y' : 'ies'} <ChevronDown size={16} className={`transition-transform ${showLog ? 'rotate-180' : ''}`} />
              </button>
              <button type="button" disabled={locked} onClick={() => db.nutrition.delete(sorted[0].id)}
                className="pressable flex min-h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[14px] font-semibold disabled:opacity-40">
                <UndoIcon size={16} /> Undo last
              </button>
            </div>
            {showLog && (
              <div className="animate-fade-in mt-2 flex flex-col">
                {sorted.map((e) => (
                  <div key={e.id} className="flex min-h-11 items-center gap-3">
                    <span className="h-2 w-2 rounded-full" style={{ background: META[e.kind].color }} />
                    <span className="flex-1 text-[15px] tabular">+{e.amount} {META[e.kind].unit}</span>
                    <span className="text-[13px] text-muted tabular">{fmtTime(new Date(e.at))}</span>
                    <button type="button" aria-label="Delete entry" disabled={locked} onClick={() => db.nutrition.delete(e.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-muted active:bg-surface-2"><XIcon size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={custom !== null} onClose={() => setCustom(null)} title={custom ? `Add ${META[custom].label.toLowerCase()}` : ''}
        action={<SheetAction disabled={!(parseInt(value, 10) > 0)} onClick={() => { if (custom) add(custom, parseInt(value, 10)); setCustom(null) }}>Add</SheetAction>}>
        <Field label={custom ? `Amount (${META[custom].unit})` : ''}>
          <div className="relative">
            <FlameIcon size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
            <TextInput inputMode="numeric" value={value} autoFocus onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
              className="pl-11 text-[22px] font-semibold tabular" placeholder="0" />
          </div>
        </Field>
      </Sheet>
    </Card>
  )
}
