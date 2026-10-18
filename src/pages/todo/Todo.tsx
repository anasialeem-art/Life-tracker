import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db, type Task, type TodoList } from '../../lib/db'
import { addDays, type DayKey } from '../../lib/day'
import { setSetting, useSetting } from '../../lib/settings'
import { compareTasks, dueLabel, isOverdue } from '../../lib/todo'
import { useToday } from '../../lib/useToday'
import { CheckListIcon, ChevronDown, ListIcon, PlusIcon } from '../../components/Icons'
import { IconButton, TopBar } from '../../components/TopBar'
import { Card, EmptyState, Page, SectionLabel, Segmented, useToast } from '../../components/ui'
import { FocusList } from './FocusList'
import { ListsSheet } from './ListsSheet'
import { QuickAdd } from './QuickAdd'
import { TaskRow } from './TaskRow'
import { TaskSheet } from './TaskSheet'

type View = 'all' | 'today' | 'upcoming'

function readCollapsed(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem('todo-collapsed') ?? '[]')) } catch { return new Set() }
}

function readView(): View {
  try { return (localStorage.getItem('todo-view') as View) || 'all' } catch { return 'all' }
}

export function Todo() {
  const today = useToday()
  const [view, setViewState] = useState<View>(readView)
  const lists = useLiveQuery(() => db.todoLists.orderBy('order').filter((l) => !l.archived).toArray())
  const openTasks = useLiveQuery(() => db.tasks.filter((t) => !t.done).toArray()) ?? []
  const defaultListId = useSetting('defaultListId')
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [focus, setFocus] = useState<{ list: TodoList; rect: DOMRect } | null>(null)
  const [manage, setManage] = useState(false)
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [toast, showToast] = useToast()

  const allLists = lists ?? []
  const byId = new Map(allLists.map((l) => [l.id, l]))
  const visible = openTasks.filter((t) => byId.has(t.listId))
  const targetListId = (defaultListId && byId.has(defaultListId) ? defaultListId : allLists[0]?.id) ?? null
  const targetList = targetListId ? byId.get(targetListId) : undefined

  const setView = (v: View) => {
    setViewState(v)
    try { localStorage.setItem('todo-view', v) } catch { /* per-device preference only */ }
  }
  const toggleCollapsed = (id: string) => {
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setCollapsed(next)
    try { localStorage.setItem('todo-collapsed', JSON.stringify([...next])) } catch { /* per-device preference only */ }
  }
  const onCompleted = (next: DayKey | null) => showToast(next ? `Done · next ${dueLabel(next, today).toLowerCase()}` : 'Done')

  // Cycle the quick-add target list.
  const cycleTarget = () => {
    if (!allLists.length) return
    const i = allLists.findIndex((l) => l.id === targetListId)
    setSetting('defaultListId', allLists[(i + 1) % allLists.length].id)
  }

  const row = (t: Task, showList = false) => (
    <TaskRow key={t.id} task={t} today={today} list={byId.get(t.listId)} showList={showList}
      onOpen={() => setEditing(t)} onCompleted={onCompleted} />
  )

  const quickDue = view === 'today' ? today : view === 'upcoming' ? addDays(today, 1) : null

  return (
    <>
      <TopBar title="To-Do" actions={<>
        <IconButton label="Manage lists" onClick={() => setManage(true)}><ListIcon size={22} /></IconButton>
        <IconButton label="New task" tinted onClick={() => setEditing('new')}><PlusIcon size={22} strokeWidth={2.4} /></IconButton>
      </>} />
      <Page>
        <Segmented value={view} onChange={setView} options={[
          { value: 'all', label: 'All' }, { value: 'today', label: 'Today' }, { value: 'upcoming', label: 'Upcoming' },
        ]} />
        <QuickAdd listId={targetListId} due={quickDue}
          placeholder={view === 'today' ? 'Add for today' : view === 'upcoming' ? 'Add for tomorrow' : `Add to ${targetList?.name ?? 'list'}`}
          prefix={targetList && (
            <button type="button" onClick={cycleTarget} aria-label={`Adding to ${targetList.name}. Tap to change list.`}
              className="pressable flex h-9 shrink-0 items-center gap-1 rounded-xl px-2 text-[14px] font-semibold"
              style={{ background: `color-mix(in srgb, ${targetList.color} 18%, transparent)`, color: targetList.color }}>
              <span>{targetList.icon}</span><ChevronDown size={14} strokeWidth={2.6} />
            </button>
          )} />

        <div key={view} className="animate-page-in flex flex-col gap-3">
          {view === 'all' && lists && (
            allLists.length === 0 ? (
              <Card><EmptyState icon={<CheckListIcon size={28} />} title="No lists">Create a list to start adding tasks.</EmptyState></Card>
            ) : allLists.map((l) => (
              <ListSection key={l.id} list={l} tasks={visible.filter((t) => t.listId === l.id).sort(compareTasks)} today={today}
                collapsed={collapsed.has(l.id)} onToggle={() => toggleCollapsed(l.id)}
                onFocus={(rect) => setFocus({ list: l, rect })} renderRow={(t) => row(t)} />
            ))
          )}

          {view === 'today' && <TodayView tasks={visible} today={today} row={row} />}
          {view === 'upcoming' && <UpcomingView tasks={visible} today={today} row={row} />}
        </div>
      </Page>

      <TaskSheet open={editing !== null} task={editing === 'new' ? null : editing} lists={allLists} defaultListId={targetListId} today={today}
        onClose={() => setEditing(null)} />
      <ListsSheet open={manage} onClose={() => setManage(false)} />
      {focus && (
        <FocusList list={focus.list} origin={focus.rect} today={today} onClose={() => setFocus(null)}
          onOpenTask={(t) => setEditing(t)} onCompleted={onCompleted} />
      )}
      {toast}
    </>
  )
}

function ListSection({ list, tasks, today, collapsed, onToggle, onFocus, renderRow }: {
  list: TodoList
  tasks: Task[]
  today: DayKey
  collapsed: boolean
  onToggle: () => void
  onFocus: (rect: DOMRect) => void
  renderRow: (t: Task) => React.ReactNode
}) {
  const overdue = tasks.filter((t) => isOverdue(t, today)).length
  return (
    <section className="overflow-hidden rounded-[22px] bg-surface shadow-card" style={{ ['--accent' as string]: list.color }}>
      <div className="flex items-center">
        <button type="button" onClick={(e) => onFocus((e.currentTarget.closest('section') as HTMLElement).getBoundingClientRect())}
          className="pressable flex min-h-[60px] min-w-0 flex-1 items-center gap-3 pl-4 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[18px]" style={{ background: `color-mix(in srgb, ${list.color} 18%, transparent)` }}>{list.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[17px] font-semibold">{list.name}</span>
            <span className="block text-[13px] text-muted">
              {tasks.length ? `${tasks.length} open` : 'All clear'}
              {overdue > 0 && <span className="font-semibold text-danger"> · {overdue} overdue</span>}
            </span>
          </span>
        </button>
        <button type="button" onClick={onToggle} aria-label={collapsed ? 'Expand' : 'Collapse'} aria-expanded={!collapsed}
          className="pressable mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted">
          <ChevronDown size={20} className={`transition-transform duration-300 ${collapsed ? '-rotate-90' : ''}`} />
        </button>
      </div>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(.2,.9,.25,1)] ${collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]'}`}>
        <div className="overflow-hidden">
          {tasks.length > 0 && <div className="border-t border-line px-4 py-1">{tasks.map(renderRow)}</div>}
        </div>
      </div>
    </section>
  )
}

function TodayView({ tasks, today, row }: { tasks: Task[]; today: DayKey; row: (t: Task, showList?: boolean) => React.ReactNode }) {
  const overdue = tasks.filter((t) => t.due && t.due < today).sort(compareTasks)
  const due = tasks.filter((t) => t.due === today).sort(compareTasks)
  if (!overdue.length && !due.length) {
    return <Card><EmptyState icon={<CheckListIcon size={28} />} title="Nothing due today">Enjoy the free time, or add something above.</EmptyState></Card>
  }
  return (
    <>
      {overdue.length > 0 && <Group title="Overdue" danger>{overdue.map((t) => row(t, true))}</Group>}
      {due.length > 0 && <Group title="Today">{due.map((t) => row(t, true))}</Group>}
    </>
  )
}

function UpcomingView({ tasks, today, row }: { tasks: Task[]; today: DayKey; row: (t: Task, showList?: boolean) => React.ReactNode }) {
  const end = addDays(today, 14)
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i + 1))
  const byDay = new Map<DayKey, Task[]>()
  for (const t of tasks) if (t.due && t.due > today && t.due <= end) byDay.set(t.due, [...(byDay.get(t.due) ?? []), t])
  const later = tasks.filter((t) => t.due && t.due > end).length
  if (!byDay.size) {
    return <Card><EmptyState icon={<CheckListIcon size={28} />} title="Nothing in the next two weeks">Dated tasks show up here, grouped by day.</EmptyState></Card>
  }
  return (
    <>
      {days.filter((d) => byDay.has(d)).map((d) => <Group key={d} title={dueLabel(d, today)}>{byDay.get(d)!.sort(compareTasks).map((t) => row(t, true))}</Group>)}
      {later > 0 && <p className="px-1 text-center text-[13px] text-muted">{later} more task{later === 1 ? '' : 's'} dated later</p>}
    </>
  )
}

function Group({ title, danger, children }: { title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <>
      <SectionLabel><span className={danger ? 'text-danger' : ''}>{title}</span></SectionLabel>
      <div className="rounded-[22px] bg-surface px-4 py-1 shadow-card">{children}</div>
    </>
  )
}
