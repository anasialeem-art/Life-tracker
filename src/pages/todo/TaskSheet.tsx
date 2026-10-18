import { useEffect, useState } from 'react'
import { db, uid, type Recurrence, type Subtask, type Task, type TodoList } from '../../lib/db'
import { addDays, type DayKey } from '../../lib/day'
import { FlagIcon, PlusIcon, TrashIcon, XIcon } from '../../components/Icons'
import { ConfirmSheet, Sheet, SheetAction } from '../../components/Sheet'
import { Check, Chip, Field, Toggle, inputCls } from '../../components/ui'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const REPEATS: { value: Recurrence['type'] | 'none'; label: string }[] = [
  { value: 'none', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export function TaskSheet({ open, task, lists, defaultListId, today, onClose }: {
  open: boolean
  /** null = new task */
  task: Task | null
  lists: TodoList[]
  defaultListId: string | null
  today: DayKey
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [listId, setListId] = useState('')
  const [due, setDue] = useState<DayKey | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [high, setHigh] = useState(false)
  const [repeat, setRepeat] = useState<Recurrence | null>(null)
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [newSub, setNewSub] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setNote(task?.note ?? '')
    setListId(task?.listId ?? defaultListId ?? lists[0]?.id ?? '')
    setDue(task?.due ?? null)
    setTime(task?.time ?? null)
    setHigh(task?.priority === 'high')
    setRepeat(task?.recurrence ?? null)
    setSubtasks(task?.subtasks ?? [])
    setNewSub('')
  }, [open, task, defaultListId, lists])

  const pendingSubs = newSub.trim() ? [...subtasks, { id: uid(), title: newSub.trim(), done: false }] : subtasks

  const save = async () => {
    if (!title.trim() || !listId) return
    const fields = {
      title: title.trim(), note: note.trim(), listId, due, time: due ? time : null,
      priority: high ? 'high' as const : 'normal' as const, recurrence: repeat, subtasks: pendingSubs,
    }
    if (task) await db.tasks.update(task.id, fields)
    else await db.tasks.add({ ...fields, id: uid(), done: false, doneAt: null, createdAt: Date.now() })
    onClose()
  }

  const addSub = () => {
    if (!newSub.trim()) return
    setSubtasks((s) => [...s, { id: uid(), title: newSub.trim(), done: false }])
    setNewSub('')
  }

  const setRepeatType = (type: Recurrence['type'] | 'none') => {
    if (type === 'none') setRepeat(null)
    else if (type === 'weekdays') setRepeat({ type, days: [1, 2, 3, 4, 5] })
    else setRepeat({ type } as Recurrence)
    if (type !== 'none' && !due) setDue(today)
  }

  const activeList = lists.find((l) => l.id === listId)

  return (
    <>
      <Sheet open={open} onClose={onClose} title={task ? 'Task' : 'New task'}
        action={<SheetAction onClick={save} disabled={!title.trim() || !listId}>{task ? 'Save' : 'Add'}</SheetAction>}>
        <div className="flex flex-col gap-5" style={activeList ? { ['--accent' as string]: activeList.color } : undefined}>
          <div className="flex flex-col gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" autoFocus={!task} enterKeyHint="done"
              className="w-full bg-transparent px-1 text-[22px] font-semibold outline-none placeholder:text-faint" />
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" rows={2}
              className="w-full resize-none rounded-2xl bg-surface-2 px-4 py-3 text-[15px] outline-none placeholder:text-faint" />
          </div>

          <Field label="List">
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
              {lists.map((l) => (
                <Chip key={l.id} active={l.id === listId} color={l.color} onClick={() => setListId(l.id)}>
                  <span>{l.icon}</span>{l.name}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Due">
            <div className="flex flex-wrap gap-2">
              <Chip active={due === today} onClick={() => setDue(today)}>Today</Chip>
              <Chip active={due === addDays(today, 1)} onClick={() => setDue(addDays(today, 1))}>Tomorrow</Chip>
              <Chip active={due === null} onClick={() => { setDue(null); setTime(null) }}>No date</Chip>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <input type="date" className={inputCls} value={due ?? ''} onChange={(e) => setDue(e.target.value || null)} aria-label="Due date" />
              <input type="time" className={`${inputCls} ${!due ? 'opacity-40' : ''}`} disabled={!due} value={time ?? ''}
                onChange={(e) => setTime(e.target.value || null)} aria-label="Due time" />
            </div>
          </Field>

          <div className="flex min-h-[52px] items-center justify-between rounded-2xl bg-surface-2 pr-2 pl-4">
            <span className="flex items-center gap-2 text-[16px]"><FlagIcon size={18} className="text-danger" /> High priority</span>
            <Toggle checked={high} onChange={setHigh} label="High priority" />
          </div>

          <Field label="Repeat">
            <div className="flex flex-wrap gap-2">
              {REPEATS.map((r) => (
                <Chip key={r.value} active={(repeat?.type ?? 'none') === r.value} onClick={() => setRepeatType(r.value)}>{r.label}</Chip>
              ))}
            </div>
            {repeat?.type === 'weekdays' && (
              <div className="mt-2 flex justify-between gap-1">
                {WEEKDAYS.map((w, i) => {
                  const on = repeat.days.includes(i)
                  return (
                    <button key={i} type="button" aria-pressed={on}
                      onClick={() => setRepeat({ type: 'weekdays', days: on ? repeat.days.filter((d) => d !== i) : [...repeat.days, i] })}
                      className={`pressable h-11 w-11 rounded-full text-[15px] font-semibold transition-colors ${on ? 'bg-accent text-white' : 'bg-surface-2 text-muted'}`}>{w}</button>
                  )
                })}
              </div>
            )}
          </Field>

          <Field label="Subtasks">
            <div className="rounded-2xl bg-surface-2 px-3">
              {subtasks.map((s) => (
                <div key={s.id} className="flex items-center gap-3 border-b border-line py-2">
                  <Check checked={s.done} size={22} onChange={(v) => setSubtasks((all) => all.map((x) => (x.id === s.id ? { ...x, done: v } : x)))} />
                  <input value={s.title} onChange={(e) => setSubtasks((all) => all.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)))}
                    className={`min-w-0 flex-1 bg-transparent text-[15px] outline-none ${s.done ? 'text-muted line-through' : ''}`} />
                  <button type="button" aria-label="Remove subtask" onClick={() => setSubtasks((all) => all.filter((x) => x.id !== s.id))}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-surface"><XIcon size={16} /></button>
                </div>
              ))}
              <div className="flex items-center gap-3 py-2">
                <span className="flex h-[22px] w-[22px] items-center justify-center text-accent"><PlusIcon size={20} /></span>
                <input value={newSub} onChange={(e) => setNewSub(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()}
                  placeholder="Add subtask" enterKeyHint="enter" className="min-h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint" />
              </div>
            </div>
          </Field>

          {task && (
            <button type="button" onClick={() => setConfirmDelete(true)}
              className="pressable flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-danger-soft text-[16px] font-semibold text-danger">
              <TrashIcon size={20} /> Delete task
            </button>
          )}
        </div>
      </Sheet>
      <ConfirmSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this task?" message={task?.title}
        confirmLabel="Delete" onConfirm={async () => { if (task) await db.tasks.delete(task.id); onClose() }} />
    </>
  )
}
