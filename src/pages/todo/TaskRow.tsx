import { useState } from 'react'
import { db, uid, type Task, type TodoList } from '../../lib/db'
import type { DayKey } from '../../lib/day'
import { dueLabel, isOverdue, nextOccurrence } from '../../lib/todo'
import { FlagIcon, NoteIcon, RepeatIcon } from '../../components/Icons'
import { Check } from '../../components/ui'

/** Completes a task; a recurring one spawns its next occurrence. Returns the next due date if any. */
export async function completeTask(task: Task, today: DayKey): Promise<DayKey | null> {
  if (task.done) {
    await db.tasks.update(task.id, { done: false, doneAt: null })
    return null
  }
  let next: DayKey | null = null
  await db.transaction('rw', db.tasks, async () => {
    await db.tasks.update(task.id, { done: true, doneAt: Date.now() })
    if (task.recurrence) {
      next = nextOccurrence(task.due, task.recurrence, today)
      await db.tasks.add({
        ...task, id: uid(), due: next, done: false, doneAt: null, createdAt: Date.now(),
        subtasks: task.subtasks.map((s) => ({ ...s, id: uid(), done: false })),
      })
    }
  })
  return next
}

export function TaskRow({ task, today, list, showList, onOpen, onCompleted, keepWhenDone }: {
  task: Task
  today: DayKey
  list?: TodoList
  showList?: boolean
  onOpen: () => void
  onCompleted?: (next: DayKey | null) => void
  /** In focus mode completed tasks stay in place (greyed); elsewhere they animate away. */
  keepWhenDone?: boolean
}) {
  const [leaving, setLeaving] = useState(false)
  const overdue = isOverdue(task, today)
  const doneSubs = task.subtasks.filter((s) => s.done).length
  const checked = task.done || leaving
  const color = list?.color

  const toggle = () => {
    if (task.done || keepWhenDone) {
      completeTask(task, today).then((n) => !task.done && onCompleted?.(n))
      return
    }
    setLeaving(true)
    setTimeout(() => completeTask(task, today).then((n) => onCompleted?.(n)), 520)
  }

  return (
    <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${leaving ? 'grid-rows-[0fr] opacity-0 delay-200' : 'grid-rows-[1fr]'}`}>
      <div className="overflow-hidden">
        <div className={`flex items-start gap-3 py-2.5 ${task.done ? 'opacity-50' : ''}`}>
          <div className="pt-0.5">
            <Check checked={checked} onChange={toggle} color={color} size={24} label={`Complete ${task.title}`} />
          </div>
          <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
            <p className={`text-[16px] leading-snug transition-colors ${checked ? 'text-muted line-through' : overdue ? 'text-danger' : ''}`}>
              {task.priority === 'high' && !checked && <FlagIcon size={14} className="mr-1 -mt-0.5 inline text-danger" strokeWidth={2.4} />}
              {task.title}
            </p>
            {(task.due || task.subtasks.length > 0 || task.note || task.recurrence || showList) && (
              <p className={`mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] ${overdue ? 'text-danger' : 'text-muted'}`}>
                {task.due && <span className={overdue ? 'font-semibold' : ''}>{dueLabel(task.due, today)}{task.time ? ` · ${task.time}` : ''}</span>}
                {task.recurrence && <RepeatIcon size={13} />}
                {task.subtasks.length > 0 && <span className="tabular">{doneSubs}/{task.subtasks.length}</span>}
                {task.note && <NoteIcon size={13} />}
                {showList && list && (
                  <span className="flex items-center gap-1 text-muted"><span className="h-2 w-2 rounded-full" style={{ background: list.color }} />{list.name}</span>
                )}
              </p>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
