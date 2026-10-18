import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, uid, type Exercise, type SplitDay } from '../../lib/db'
import type { DayKey } from '../../lib/day'
import { setSetting, useSettings } from '../../lib/settings'
import { ArrowDownIcon, ArrowUpIcon, ChevronRight, PlusIcon, TrashIcon, XIcon } from '../../components/Icons'
import { ConfirmSheet, Sheet, SheetAction } from '../../components/Sheet'
import { Button, Field, Segmented, TextInput, Toggle, inputCls } from '../../components/ui'

const WEEK = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

async function swapOrder(items: SplitDay[], i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= items.length) return
  await db.transaction('rw', db.splitDays, async () => {
    await db.splitDays.update(items[i].id, { order: items[j].order })
    await db.splitDays.update(items[j].id, { order: items[i].order })
  })
}

export function SplitEditor({ open, onClose, today }: { open: boolean; onClose: () => void; today: DayKey }) {
  const settings = useSettings()
  const splits = useLiveQuery(() => db.splitDays.orderBy('order').toArray()) ?? []
  const [editing, setEditing] = useState<SplitDay | 'new' | null>(null)
  const [pickFor, setPickFor] = useState<number | null>(null)
  if (!settings) return null
  const mode = settings.splitMode
  const anchors = settings.cycleAnchors
  const cycleStart = anchors.length ? [...anchors].sort((a, b) => (a.day < b.day ? -1 : 1))[0].day : today

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Training split">
        <div className="flex flex-col gap-5">
          <Field label="Mode" hint={mode === 'weekday' ? 'Each split day is tied to a weekday, e.g. Monday = Legs.' : 'Split days rotate in order, one per day, regardless of weekday.'}>
            <Segmented value={mode} onChange={(v) => { setSetting('splitMode', v); if (v === 'cycle' && !anchors.length) setSetting('cycleAnchors', [{ day: today, index: 0 }]) }} options={[{ value: 'weekday', label: 'Weekdays' }, { value: 'cycle', label: 'Cycle' }]} />
          </Field>

          <Field label={mode === 'cycle' ? 'Split days (in cycle order)' : 'Split days'}>
            <div className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface-2/70">
              {splits.map((s, i) => (
                <div key={s.id} className="flex min-h-[58px] items-center gap-1 pr-1 pl-4">
                  <button type="button" onClick={() => setEditing(s)} className="min-w-0 flex-1 py-2 text-left">
                    <span className="block truncate text-[16px] font-semibold">{mode === 'cycle' && <span className="mr-2 text-muted tabular">{i + 1}.</span>}{s.name}</span>
                    <span className="block text-[13px] text-muted">{s.rest ? 'Rest day' : `${s.exercises.length} exercise${s.exercises.length === 1 ? '' : 's'}`}</span>
                  </button>
                  <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => swapOrder(splits, i, -1)}
                    className="pressable flex h-10 w-10 items-center justify-center rounded-full text-muted disabled:opacity-25"><ArrowUpIcon size={18} /></button>
                  <button type="button" aria-label="Move down" disabled={i === splits.length - 1} onClick={() => swapOrder(splits, i, 1)}
                    className="pressable flex h-10 w-10 items-center justify-center rounded-full text-muted disabled:opacity-25"><ArrowDownIcon size={18} /></button>
                  <ChevronRight size={18} className="text-faint" />
                </div>
              ))}
              {splits.length === 0 && <p className="px-4 py-5 text-center text-[14px] text-muted">No split days yet. Add Push, Pull, Legs, Rest…</p>}
            </div>
            <Button variant="tinted" className="mt-2" onClick={() => setEditing('new')}><PlusIcon size={20} /> Add split day</Button>
          </Field>

          {mode === 'weekday' && splits.length > 0 && (
            <Field label="Weekly plan">
              <div className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface-2/70">
                {WEEK.map((wd) => {
                  const id = settings.weekdayPlan[String(wd)]
                  const s = splits.find((x) => x.id === id)
                  return (
                    <button key={wd} type="button" onClick={() => setPickFor(wd)} className="flex min-h-[52px] w-full items-center justify-between px-4 text-left active:bg-surface-2">
                      <span className="text-[16px]">{WEEKDAY_NAMES[wd]}</span>
                      <span className={`flex items-center gap-1 text-[15px] ${s ? 'font-semibold text-accent' : 'text-muted'}`}>{s?.name ?? 'Nothing'} <ChevronRight size={16} /></span>
                    </button>
                  )
                })}
              </div>
            </Field>
          )}

          {mode === 'cycle' && splits.length > 0 && (
            <Field label="Cycle start" hint={`Step 1 (${splits[0].name}) falls on this day. “Change today” on the Fitness tab restarts the rotation from any step.`}>
              <input type="date" className={inputCls} value={cycleStart}
                onChange={(e) => e.target.value && setSetting('cycleAnchors', [{ day: e.target.value, index: 0 }])} />
            </Field>
          )}
        </div>
      </Sheet>

      <SplitDayEditor open={editing !== null} split={editing === 'new' ? null : editing} count={splits.length} onClose={() => setEditing(null)} />

      <Sheet open={pickFor !== null} onClose={() => setPickFor(null)} title={pickFor !== null ? WEEKDAY_NAMES[pickFor] : ''}>
        <div className="flex flex-col gap-2">
          {[null, ...splits].map((s) => {
            const active = (settings.weekdayPlan[String(pickFor)] ?? null) === (s?.id ?? null)
            return (
              <button key={s?.id ?? 'none'} type="button"
                onClick={() => { setSetting('weekdayPlan', { ...settings.weekdayPlan, [String(pickFor)]: s?.id ?? null }); setPickFor(null) }}
                className={`pressable flex min-h-[54px] items-center justify-between rounded-2xl px-4 text-left text-[16px] font-semibold ${active ? 'bg-accent text-white' : 'bg-surface-2'}`}>
                {s?.name ?? 'Nothing planned'}
                {s?.rest && <span className={`text-[13px] font-medium ${active ? 'text-white/80' : 'text-muted'}`}>Rest</span>}
              </button>
            )
          })}
        </div>
      </Sheet>
    </>
  )
}

function SplitDayEditor({ open, split, count, onClose }: { open: boolean; split: SplitDay | null; count: number; onClose: () => void }) {
  const [name, setName] = useState('')
  const [rest, setRest] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(split?.name ?? '')
    setRest(split?.rest ?? false)
    setExercises(split?.exercises ?? [])
  }, [open, split])

  const save = async () => {
    if (!name.trim()) return
    const clean = exercises.filter((e) => e.name.trim()).map((e) => ({ ...e, name: e.name.trim() }))
    if (split) await db.splitDays.update(split.id, { name: name.trim(), rest, exercises: clean })
    else await db.splitDays.add({ id: uid(), name: name.trim(), rest, exercises: clean, order: Date.now() + count })
    onClose()
  }

  const update = (id: string, patch: Partial<Exercise>) => setExercises((all) => all.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  const moveEx = (i: number, dir: -1 | 1) => setExercises((all) => {
    const j = i + dir
    if (j < 0 || j >= all.length) return all
    const next = [...all]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })

  return (
    <>
      <Sheet open={open} onClose={onClose} title={split ? 'Edit split day' : 'New split day'}
        action={<SheetAction onClick={save} disabled={!name.trim()}>{split ? 'Save' : 'Add'}</SheetAction>}>
        <div className="flex flex-col gap-5">
          <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Push" autoFocus={!split} /></Field>
          <div className="flex min-h-[52px] items-center justify-between rounded-2xl bg-surface-2 pr-2 pl-4">
            <span className="text-[16px]">Rest day</span>
            <Toggle checked={rest} onChange={setRest} label="Rest day" />
          </div>
          {!rest && (
            <Field label="Exercises">
              <div className="flex flex-col gap-2">
                {exercises.map((e, i) => (
                  <div key={e.id} className="flex items-center gap-1.5 rounded-2xl bg-surface-2 p-1.5 pl-3">
                    <input value={e.name} onChange={(ev) => update(e.id, { name: ev.target.value })} placeholder="Exercise"
                      className="min-h-10 min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-faint" />
                    <input value={e.sets ?? ''} inputMode="numeric" placeholder="4" aria-label="Sets"
                      onChange={(ev) => update(e.id, { sets: ev.target.value ? parseInt(ev.target.value.replace(/\D/g, ''), 10) || null : null })}
                      className="h-10 w-10 rounded-xl bg-surface text-center text-[15px] outline-none tabular" />
                    <span className="text-muted">×</span>
                    <input value={e.reps ?? ''} placeholder="8" aria-label="Reps" onChange={(ev) => update(e.id, { reps: ev.target.value || null })}
                      className="h-10 w-12 rounded-xl bg-surface text-center text-[15px] outline-none tabular" />
                    <div className="flex flex-col">
                      <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => moveEx(i, -1)} className="flex h-5 w-7 items-center justify-center text-muted disabled:opacity-20"><ArrowUpIcon size={14} /></button>
                      <button type="button" aria-label="Move down" disabled={i === exercises.length - 1} onClick={() => moveEx(i, 1)} className="flex h-5 w-7 items-center justify-center text-muted disabled:opacity-20"><ArrowDownIcon size={14} /></button>
                    </div>
                    <button type="button" aria-label="Remove exercise" onClick={() => setExercises((all) => all.filter((x) => x.id !== e.id))}
                      className="flex h-10 w-8 items-center justify-center text-muted"><XIcon size={16} /></button>
                  </div>
                ))}
                <Button variant="secondary" onClick={() => setExercises((all) => [...all, { id: uid(), name: '', sets: null, reps: null }])}>
                  <PlusIcon size={20} /> Add exercise
                </Button>
              </div>
            </Field>
          )}
          {split && (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="pressable flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-danger-soft text-[16px] font-semibold text-danger">
              <TrashIcon size={20} /> Delete split day
            </button>
          )}
        </div>
      </Sheet>
      <ConfirmSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${split?.name ?? ''}?`}
        message="Your training log keeps the days you marked as trained." confirmLabel="Delete"
        onConfirm={async () => { if (split) await db.splitDays.delete(split.id); onClose() }} />
    </>
  )
}
