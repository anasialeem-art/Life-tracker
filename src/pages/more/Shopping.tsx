import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { db, uid } from '../../lib/db'
import { CartIcon, PlusIcon, TrashIcon, XIcon } from '../../components/Icons'
import { TopBar } from '../../components/TopBar'
import { Card, Check, EmptyState, Page, SectionLabel } from '../../components/ui'

/** Adds an item (or un-ticks it if it's already on the list) and counts it for the quick re-add chips. */
async function addItem(raw: string) {
  const name = raw.trim()
  if (!name) return
  const key = name.toLowerCase()
  await db.transaction('rw', db.shoppingItems, db.shoppingHistory, async () => {
    const existing = (await db.shoppingItems.toArray()).find((i) => i.name.toLowerCase() === key)
    if (existing) {
      if (existing.checked) await db.shoppingItems.update(existing.id, { checked: false, checkedAt: null, createdAt: Date.now() })
    } else {
      await db.shoppingItems.add({ id: uid(), name, checked: false, createdAt: Date.now(), checkedAt: null })
    }
    const h = await db.shoppingHistory.get(key)
    await db.shoppingHistory.put({ key, name: h?.name ?? name, count: (h?.count ?? 0) + 1, lastAt: Date.now() })
  })
}

export function Shopping() {
  const items = useLiveQuery(() => db.shoppingItems.toArray())
  const history = useLiveQuery(() => db.shoppingHistory.orderBy('count').reverse().limit(30).toArray()) ?? []
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const open = (items ?? []).filter((i) => !i.checked).sort((a, b) => a.createdAt - b.createdAt)
  const ticked = (items ?? []).filter((i) => i.checked).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0))
  const onList = new Set(open.map((i) => i.name.toLowerCase()))
  const frequent = history.filter((h) => !onList.has(h.key)).slice(0, 14)

  const submit = () => {
    // Clear first so typing the next item while this one saves isn't wiped.
    const value = text
    setText('')
    input.current?.focus()
    addItem(value)
  }
  const toggle = (id: string, checked: boolean) => db.shoppingItems.update(id, { checked, checkedAt: checked ? Date.now() : null })

  return (
    <>
      <TopBar title="Shopping List" backTo="/more" />
      <Page>
        <form onSubmit={(e) => { e.preventDefault(); submit() }}
          className="flex min-h-[52px] items-center gap-2 rounded-2xl bg-surface pr-1.5 pl-3 shadow-card focus-within:ring-2 focus-within:ring-accent/40">
          <PlusIcon size={22} className="text-accent" />
          <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add an item" enterKeyHint="enter"
            className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint" />
          {text.trim() && <button type="submit" className="animate-pop h-9 rounded-xl bg-accent px-3 text-[14px] font-semibold text-white">Add</button>}
        </form>

        {frequent.length > 0 && (
          <>
            <SectionLabel>Buy again</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {frequent.map((h) => (
                <button key={h.key} type="button" onClick={() => addItem(h.name)}
                  className="pressable flex min-h-10 items-center gap-1 rounded-full bg-surface px-3.5 text-[14px] font-semibold shadow-card">
                  <PlusIcon size={15} className="text-accent" strokeWidth={2.6} />{h.name}
                </button>
              ))}
            </div>
          </>
        )}

        {items && items.length === 0 ? (
          <Card><EmptyState icon={<CartIcon size={28} />} title="Your list is empty">Add items above. Things you buy often show up as quick chips.</EmptyState></Card>
        ) : (
          <div className="rounded-[22px] bg-surface px-4 py-1 shadow-card">
            {open.map((i) => (
              <div key={i.id} className="animate-fade-in flex min-h-[54px] items-center gap-3 border-b border-line py-1.5 last:border-0">
                <Check checked={false} onChange={() => toggle(i.id, true)} size={26} label={`Tick ${i.name}`} />
                <span className="min-w-0 flex-1 truncate text-[16px]">{i.name}</span>
                <button type="button" aria-label={`Remove ${i.name}`} onClick={() => db.shoppingItems.delete(i.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-faint active:bg-surface-2"><XIcon size={17} /></button>
              </div>
            ))}
            {open.length === 0 && ticked.length > 0 && <p className="py-4 text-center text-[15px] text-muted">All done 🎉</p>}
            {ticked.map((i) => (
              <div key={i.id} className="flex min-h-[50px] items-center gap-3 border-b border-line py-1.5 opacity-55 last:border-0">
                <Check checked onChange={() => toggle(i.id, false)} size={26} label={`Untick ${i.name}`} />
                <span className="min-w-0 flex-1 truncate text-[16px] text-muted line-through">{i.name}</span>
              </div>
            ))}
          </div>
        )}

        {ticked.length > 0 && (
          <button type="button" onClick={() => db.shoppingItems.bulkDelete(ticked.map((i) => i.id))}
            className="pressable flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-surface-2 text-[15px] font-semibold text-muted">
            <TrashIcon size={18} /> Clear {ticked.length} ticked item{ticked.length === 1 ? '' : 's'}
          </button>
        )}
      </Page>
    </>
  )
}
