import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useBackClose } from '../../lib/backstack'
import { db, type Task, type TodoList } from '../../lib/db'
import type { DayKey } from '../../lib/day'
import { compareTasks } from '../../lib/todo'
import { QuickAdd } from './QuickAdd'
import { TaskRow } from './TaskRow'

const CLOSE_DRAG_PX = 120

/**
 * A list popped out as a floating card (like long-pressing a chat): zooms from
 * its header, blurs the page behind, scrolls independently. Shows everything in
 * the list, done tasks greyed. Tap the backdrop or swipe the card down to close.
 */
export function FocusList({ list, origin, today, onClose, onOpenTask, onCompleted }: {
  list: TodoList
  origin: DOMRect | null
  today: DayKey
  onClose: () => void
  onOpenTask: (t: Task) => void
  onCompleted: (next: DayKey | null) => void
}) {
  const tasks = useLiveQuery(() => db.tasks.where('listId').equals(list.id).toArray(), [list.id]) ?? []
  const card = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)
  const [dragY, setDragY] = useState(0)
  const drag = useRef<number | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  /** Transform that maps the card onto the list header it came from. */
  const fromOrigin = () => {
    const el = card.current
    if (!el || !origin) return 'translateY(40px) scale(0.92)'
    const r = el.getBoundingClientRect()
    const sx = origin.width / r.width
    const dx = origin.left + origin.width / 2 - (r.left + r.width / 2)
    const dy = origin.top + origin.height / 2 - (r.top + r.height / 2)
    return `translate(${dx}px, ${dy}px) scale(${sx}, ${Math.max(0.08, origin.height / r.height)})`
  }

  useLayoutEffect(() => {
    const el = card.current
    if (!el) return
    el.style.transition = 'none'
    el.style.transform = fromOrigin()
    el.style.opacity = '0.4'
    el.getBoundingClientRect()
    el.style.transition = 'transform 420ms cubic-bezier(.16,1,.3,1), opacity 220ms ease'
    el.style.transform = 'none'
    el.style.opacity = '1'
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => {
    if (closing) return
    setClosing(true)
    const el = card.current
    if (el) {
      el.style.transition = 'transform 300ms cubic-bezier(.4,0,.2,1), opacity 260ms ease'
      el.style.transform = fromOrigin()
      el.style.opacity = '0'
    }
    setTimeout(() => closeRef.current(), 290)
  }

  useBackClose(!closing, close)

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const onDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return
    drag.current = e.clientY
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (drag.current === null || !card.current) return
    const y = Math.max(0, e.clientY - drag.current)
    setDragY(y)
    card.current.style.transition = 'none'
    card.current.style.transform = `translateY(${y}px) scale(${1 - Math.min(y, 300) / 3000})`
  }
  const onUp = () => {
    if (drag.current === null || !card.current) return
    drag.current = null
    if (dragY > CLOSE_DRAG_PX) close()
    else {
      card.current.style.transition = 'transform 280ms cubic-bezier(.2,.9,.25,1)'
      card.current.style.transform = 'none'
    }
    setDragY(0)
  }

  const open = tasks.filter((t) => !t.done).sort(compareTasks)
  const done = tasks.filter((t) => t.done).sort(compareTasks)

  return createPortal(
    <div data-sec="todo" className="fixed inset-0 z-50 flex items-center justify-center px-4 pt-[max(env(safe-area-inset-top),24px)] pb-[max(env(safe-area-inset-bottom),24px)]"
      style={{ ['--accent' as string]: list.color }}>
      <div onClick={close}
        className={`absolute inset-0 bg-black/35 backdrop-blur-[14px] backdrop-saturate-150 transition-opacity duration-300 ${closing ? 'opacity-0' : 'animate-fade-in'}`} />
      <div ref={card} role="dialog" aria-modal="true" aria-label={list.name}
        className="relative flex max-h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-[30px] bg-surface shadow-[0_30px_80px_-20px_rgb(0_0_0/0.5)] will-change-transform">
        <div className="shrink-0 touch-none px-5 pt-3 pb-3" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-faint/60" />
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-[14px] text-[22px]" style={{ background: `color-mix(in srgb, ${list.color} 20%, transparent)` }}>{list.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[22px] font-bold tracking-tight">{list.name}</p>
              <p className="text-[13px] text-muted">{open.length} open · {done.length} done</p>
            </div>
          </div>
          <div className="mt-3"><QuickAdd listId={list.id} due={null} placeholder={`Add to ${list.name}`} /></div>
        </div>
        <div className="min-h-24 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
          {open.map((t) => <TaskRow key={t.id} task={t} today={today} list={list} keepWhenDone onOpen={() => onOpenTask(t)} onCompleted={onCompleted} />)}
          {open.length === 0 && <p className="py-6 text-center text-[15px] text-muted">Nothing open in this list.</p>}
          {done.length > 0 && (
            <>
              <p className="pt-4 pb-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">Completed</p>
              {done.map((t) => <TaskRow key={t.id} task={t} today={today} list={list} keepWhenDone onOpen={() => onOpenTask(t)} />)}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
