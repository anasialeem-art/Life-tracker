import { useRef, useState, type ReactNode } from 'react'
import { db, uid } from '../../lib/db'
import type { DayKey } from '../../lib/day'
import { PlusIcon } from '../../components/Icons'

/** Type + enter adds a task. Keeps focus so several can be added in a row. */
export function QuickAdd({ listId, due, placeholder = 'Add a task', prefix, onAdded }: {
  listId: string | null
  due: DayKey | null
  placeholder?: string
  /** Element inside the bar before the input (e.g. the target-list picker). */
  prefix?: ReactNode
  onAdded?: () => void
}) {
  const [title, setTitle] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const add = async () => {
    const t = title.trim()
    if (!t || !listId) return
    setTitle('')
    await db.tasks.add({
      id: uid(), listId, title: t, note: '', due, time: null, priority: 'normal', subtasks: [], recurrence: null,
      done: false, doneAt: null, createdAt: Date.now(),
    })
    onAdded?.()
    input.current?.focus()
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); add() }}
      className="flex min-h-[50px] items-center gap-2 rounded-2xl bg-surface-2 pr-1.5 pl-2 focus-within:ring-2 focus-within:ring-accent/40">
      {prefix ?? <span className="flex h-8 w-8 items-center justify-center text-accent"><PlusIcon size={22} /></span>}
      <input ref={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} enterKeyHint="enter"
        className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint" />
      {title.trim() && (
        <button type="submit" className="animate-pop flex h-9 items-center rounded-xl bg-accent px-3 text-[14px] font-semibold text-white">Add</button>
      )}
    </form>
  )
}
