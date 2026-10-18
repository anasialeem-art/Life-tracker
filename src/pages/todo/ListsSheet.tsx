import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, uid, type TodoList } from '../../lib/db'
import { LIST_COLORS, LIST_ICONS } from '../../lib/todo'
import { ArchiveIcon, ArrowDownIcon, ArrowUpIcon, ChevronRight, PlusIcon } from '../../components/Icons'
import { Sheet, SheetAction } from '../../components/Sheet'
import { Button, Field, TextInput } from '../../components/ui'

async function move(lists: TodoList[], index: number, dir: -1 | 1) {
  const j = index + dir
  if (j < 0 || j >= lists.length) return
  const a = lists[index]
  const b = lists[j]
  await db.transaction('rw', db.todoLists, async () => {
    await db.todoLists.update(a.id, { order: b.order })
    await db.todoLists.update(b.id, { order: a.order })
  })
}

/** Manage to-do lists: create, rename, recolor, reorder, archive. */
export function ListsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lists = useLiveQuery(() => db.todoLists.orderBy('order').toArray()) ?? []
  const [editing, setEditing] = useState<TodoList | 'new' | null>(null)
  const active = lists.filter((l) => !l.archived)
  const archived = lists.filter((l) => l.archived)

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Lists">
        <div className="flex flex-col gap-4">
          <div className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface-2/70">
            {active.map((l, i) => (
              <div key={l.id} className="flex min-h-[56px] items-center gap-2 pr-2 pl-3">
                <button type="button" onClick={() => setEditing(l)} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[11px] text-[18px]" style={{ background: `color-mix(in srgb, ${l.color} 20%, transparent)` }}>{l.icon}</span>
                  <span className="truncate text-[16px] font-medium">{l.name}</span>
                </button>
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(active, i, -1)}
                  className="pressable flex h-9 w-9 items-center justify-center rounded-full text-muted disabled:opacity-25"><ArrowUpIcon size={18} /></button>
                <button type="button" aria-label="Move down" disabled={i === active.length - 1} onClick={() => move(active, i, 1)}
                  className="pressable flex h-9 w-9 items-center justify-center rounded-full text-muted disabled:opacity-25"><ArrowDownIcon size={18} /></button>
                <ChevronRight size={18} className="text-faint" />
              </div>
            ))}
          </div>
          <Button variant="tinted" onClick={() => setEditing('new')}><PlusIcon size={20} /> New list</Button>

          {archived.length > 0 && (
            <>
              <p className="px-1 pt-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">Archived</p>
              <div className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface-2/70">
                {archived.map((l) => (
                  <div key={l.id} className="flex min-h-[52px] items-center gap-3 px-3">
                    <span className="text-[18px] opacity-60">{l.icon}</span>
                    <span className="flex-1 truncate text-[16px] text-muted">{l.name}</span>
                    <button type="button" onClick={() => db.todoLists.update(l.id, { archived: false })} className="px-2 text-[15px] font-semibold text-accent">Restore</button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Sheet>
      <ListEditor open={editing !== null} list={editing === 'new' ? null : editing} count={lists.length} onClose={() => setEditing(null)} />
    </>
  )
}

function ListEditor({ open, list, count, onClose }: { open: boolean; list: TodoList | null; count: number; onClose: () => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(LIST_COLORS[0])
  const [icon, setIcon] = useState(LIST_ICONS[0])

  useEffect(() => {
    if (!open) return
    setName(list?.name ?? '')
    setColor(list?.color ?? LIST_COLORS[count % LIST_COLORS.length])
    setIcon(list?.icon ?? LIST_ICONS[count % LIST_ICONS.length])
  }, [open, list, count])

  const save = async () => {
    if (!name.trim()) return
    if (list) await db.todoLists.update(list.id, { name: name.trim(), color, icon })
    else await db.todoLists.add({ id: uid(), name: name.trim(), color, icon, order: Date.now(), archived: false })
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={list ? 'Edit list' : 'New list'}
      action={<SheetAction onClick={save} disabled={!name.trim()}>{list ? 'Save' : 'Create'}</SheetAction>}>
      <div className="flex flex-col gap-5" style={{ ['--accent' as string]: color }}>
        <div className="flex justify-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-[24px] text-[38px] transition-colors" style={{ background: `color-mix(in srgb, ${color} 22%, transparent)` }}>{icon}</span>
        </div>
        <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. University" autoFocus={!list} /></Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-3">
            {LIST_COLORS.map((c) => (
              <button key={c} type="button" aria-label={c} onClick={() => setColor(c)}
                className={`pressable h-10 w-10 rounded-full transition-shadow ${c === color ? 'ring-[3px] ring-offset-2 ring-offset-surface' : ''}`}
                style={{ background: c, ['--tw-ring-color' as string]: c }} />
            ))}
          </div>
        </Field>
        <Field label="Icon">
          <div className="grid grid-cols-6 gap-2">
            {LIST_ICONS.map((i) => (
              <button key={i} type="button" onClick={() => setIcon(i)}
                className={`pressable flex h-12 items-center justify-center rounded-2xl text-[22px] ${i === icon ? 'bg-accent-soft ring-2 ring-accent' : 'bg-surface-2'}`}>{i}</button>
            ))}
          </div>
        </Field>
        {list && (
          <button type="button" onClick={async () => { await db.todoLists.update(list.id, { archived: !list.archived }); onClose() }}
            className="pressable flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-danger-soft text-[16px] font-semibold text-danger">
            <ArchiveIcon size={20} /> {list.archived ? 'Restore list' : 'Archive list'}
          </button>
        )}
      </div>
    </Sheet>
  )
}
