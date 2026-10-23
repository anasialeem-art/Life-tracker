import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, type FinCategory, type FinRule } from '../../lib/db'
import { ALL_CATEGORIES, CATEGORY_META, addRule, recategorizeAll, ruleMatches, sortRules } from '../../lib/finance'
import { ArrowDownIcon, ArrowUpIcon, ListIcon, PlusIcon, TrashIcon } from '../../components/Icons'
import { Sheet, SheetAction } from '../../components/Sheet'
import { IconButton, TopBar } from '../../components/TopBar'
import { Button, Card, Chip, EmptyState, Field, Page, Segmented, inputCls } from '../../components/ui'
import { CategoryBadge } from './parts'

const FIELD_LABEL: Record<FinRule['field'], string> = { payee: 'Payee', purpose: 'Purpose', any: 'Payee or purpose' }

export function Rules() {
  const rules = useLiveQuery(async () => sortRules(await db.finRules.toArray()))
  const [editing, setEditing] = useState<FinRule | 'new' | null>(null)

  const move = async (i: number, dir: -1 | 1) => {
    if (!rules) return
    const j = i + dir
    if (j < 0 || j >= rules.length) return
    // Renumber the whole list so equal orders (starter rules) swap cleanly.
    const next = [...rules]
    ;[next[i], next[j]] = [next[j], next[i]]
    await db.finRules.bulkPut(next.map((r, k) => ({ ...r, order: k })))
    await recategorizeAll()
  }

  return (
    <>
      <TopBar title="Rules" backTo="/more/finance/settings" actions={
        <IconButton label="Add rule" tinted onClick={() => setEditing('new')}><PlusIcon size={22} strokeWidth={2.4} /></IconButton>
      } />
      <Page>
        <p className="px-1 text-[14px] leading-relaxed text-muted">
          Rules sort new and existing transactions automatically. The first matching rule wins. Categories you set by hand are never changed.
        </p>
        {rules && rules.length === 0 && (
          <Card>
            <EmptyState icon={<ListIcon size={26} />} title="No rules yet" action={<Button small onClick={() => setEditing('new')}><PlusIcon size={18} /> Add rule</Button>}>
              Rules are also created when you change a transaction's category and choose "apply to all similar".
            </EmptyState>
          </Card>
        )}
        {!!rules?.length && (
          <div className="divide-y divide-line overflow-hidden rounded-[22px] bg-surface shadow-card">
            {rules.map((r, i) => (
              <div key={r.id} className="flex min-h-[60px] items-center gap-1 pr-1 pl-3">
                <button type="button" onClick={() => setEditing(r)} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left">
                  <CategoryBadge category={r.category} size={34} />
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-medium">“{r.contains}”</span>
                    <span className="block truncate text-[13px] text-muted">{FIELD_LABEL[r.field]} contains → {CATEGORY_META[r.category].label}</span>
                  </span>
                </button>
                <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="pressable flex h-10 w-9 items-center justify-center text-muted disabled:opacity-25"><ArrowUpIcon size={18} /></button>
                <button type="button" aria-label="Move down" disabled={i === rules.length - 1} onClick={() => move(i, 1)} className="pressable flex h-10 w-9 items-center justify-center text-muted disabled:opacity-25"><ArrowDownIcon size={18} /></button>
              </div>
            ))}
          </div>
        )}
      </Page>
      <RuleSheet rule={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function RuleSheet({ rule, onClose }: { rule: FinRule | 'new' | null; onClose: () => void }) {
  const [field, setField] = useState<FinRule['field']>('payee')
  const [contains, setContains] = useState('')
  const [category, setCategory] = useState<FinCategory>('groceries')
  const all = useLiveQuery(() => (rule ? db.finTx.toArray() : []), [rule]) ?? []

  useEffect(() => {
    if (!rule) return
    setField(rule === 'new' ? 'payee' : rule.field)
    setContains(rule === 'new' ? '' : rule.contains)
    setCategory(rule === 'new' ? 'groceries' : rule.category)
  }, [rule])

  const probe: FinRule = { id: '', field, contains, category, order: 0, createdAt: 0 }
  const matches = contains.trim() ? all.filter((t) => ruleMatches(probe, t)).length : 0

  const save = async () => {
    if (!contains.trim()) return
    if (rule === 'new') await addRule({ field, contains, category })
    else if (rule) {
      await db.finRules.update(rule.id, { field, contains: contains.trim(), category })
      await recategorizeAll()
    }
    onClose()
  }
  const remove = async () => {
    if (rule && rule !== 'new') {
      await db.finRules.delete(rule.id)
      await recategorizeAll()
    }
    onClose()
  }

  return (
    <Sheet open={rule !== null} onClose={onClose} title={rule === 'new' ? 'New rule' : 'Edit rule'}
      action={<SheetAction onClick={save} disabled={!contains.trim()}>Save</SheetAction>}>
      <div className="flex flex-col gap-5">
        <Field label="Match when">
          <Segmented value={field} onChange={setField} options={[
            { value: 'payee', label: 'Payee' }, { value: 'purpose', label: 'Purpose' }, { value: 'any', label: 'Either' },
          ]} />
        </Field>
        <Field label="contains" hint={contains.trim() ? `Matches ${matches} transaction${matches === 1 ? '' : 's'} (ignoring upper/lower case)` : undefined}>
          <input value={contains} onChange={(e) => setContains(e.target.value)} placeholder="e.g. REWE" className={inputCls} autoFocus={rule === 'new'} />
        </Field>
        <Field label="Category">
          <div className="flex flex-wrap gap-2">
            {ALL_CATEGORIES.map((c) => (
              <Chip key={c} active={category === c} color={CATEGORY_META[c].color} onClick={() => setCategory(c)}>
                <span>{CATEGORY_META[c].icon}</span>{CATEGORY_META[c].label}
              </Chip>
            ))}
          </div>
        </Field>
        {rule && rule !== 'new' && (
          <button type="button" onClick={remove}
            className="pressable flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-danger-soft text-[16px] font-semibold text-danger">
            <TrashIcon size={20} /> Delete rule
          </button>
        )}
      </div>
    </Sheet>
  )
}
