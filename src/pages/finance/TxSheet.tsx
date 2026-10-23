import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, type FinCategory, type FinRule, type FinTx } from '../../lib/db'
import { ALL_CATEGORIES, CATEGORY_META, addRule, formatEUR, ruleMatches, setTxCategory, suggestRule } from '../../lib/finance'
import { Sheet } from '../../components/Sheet'
import { Button, Chip, Field, Segmented, TextInput, inputCls } from '../../components/ui'
import { txTitle } from './parts'

/** Change a transaction's category or note; offers to turn a correction into a rule. */
export function TxSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const tx = useLiveQuery(() => (id ? db.finTx.get(id) : undefined), [id])
  const [note, setNote] = useState('')
  const [ask, setAsk] = useState<{ tx: FinTx; category: FinCategory } | null>(null)

  useEffect(() => { if (tx) setNote(tx.note) }, [tx?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveNote = async () => {
    if (tx && note.trim() !== tx.note) await db.finTx.update(tx.id, { note: note.trim() })
  }
  const close = async () => {
    await saveNote()
    onClose()
  }
  const pick = async (category: FinCategory) => {
    if (!tx || category === tx.category) return
    await setTxCategory(tx.id, category)
    setAsk({ tx, category })
  }

  return (
    <>
      <Sheet open={id !== null && !ask} onClose={close} title="Transaction">
        {tx && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <p className={`text-[38px] font-bold tracking-tight tabular ${tx.amount > 0 ? 'text-success' : ''}`}>{formatEUR(tx.amount, { sign: true })}</p>
              <p className="text-[17px] font-semibold">{txTitle(tx)}</p>
              <p className="text-[14px] text-muted">{new Date(`${tx.day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            {(tx.purpose || tx.payeeIban) && (
              <div className="rounded-2xl bg-surface-2 p-4 text-[14px] leading-relaxed select-text">
                {tx.purpose && <p className="break-words">{tx.purpose}</p>}
                {tx.payeeIban && <p className="mt-1 font-mono text-[13px] text-muted">{tx.payeeIban.replace(/(.{4})/g, '$1 ').trim()}</p>}
              </div>
            )}
            <Field label="Category" hint={tx.categorySource === 'rule' ? 'Set by a rule' : tx.categorySource === 'auto' ? 'Set automatically' : tx.categorySource === 'manual' ? 'Set by you' : undefined}>
              <div className="flex flex-wrap gap-2">
                {ALL_CATEGORIES.map((c) => (
                  <Chip key={c} active={tx.category === c} color={CATEGORY_META[c].color} onClick={() => pick(c)}>
                    <span>{CATEGORY_META[c].icon}</span>{CATEGORY_META[c].label}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Note">
              <TextInput value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} placeholder="Add a note" />
            </Field>
          </div>
        )}
      </Sheet>
      <ApplySimilarSheet ask={ask} onDone={() => setAsk(null)} />
    </>
  )
}

/** "Apply to all similar transactions?" — creates a rule if yes. */
function ApplySimilarSheet({ ask, onDone }: { ask: { tx: FinTx; category: FinCategory } | null; onDone: () => void }) {
  const [field, setField] = useState<FinRule['field']>('payee')
  const [contains, setContains] = useState('')
  const all = useLiveQuery(() => (ask ? db.finTx.toArray() : []), [ask]) ?? []

  useEffect(() => {
    if (!ask) return
    const s = suggestRule(ask.tx)
    setField(s.field)
    setContains(s.contains)
  }, [ask])

  const probe = { id: '', field, contains, category: ask?.category ?? 'other', order: 0, createdAt: 0 }
  const matches = contains.trim() ? all.filter((t) => t.id !== ask?.tx.id && t.categorySource !== 'manual' && ruleMatches(probe, t)) : []
  const meta = ask ? CATEGORY_META[ask.category] : null

  const yes = async () => {
    if (ask && contains.trim()) await addRule({ field, contains, category: ask.category })
    onDone()
  }

  return (
    <Sheet open={ask !== null} onClose={onDone} title="Apply to all similar?">
      {ask && meta && (
        <div className="flex flex-col gap-4">
          <p className="text-center text-[15px] leading-relaxed text-muted">
            Put every transaction like this one under <span className="font-semibold text-text">{meta.icon} {meta.label}</span>, now and in future syncs?
          </p>
          <Field label="Match when">
            <Segmented value={field} onChange={setField} options={[
              { value: 'payee', label: 'Payee' }, { value: 'purpose', label: 'Purpose' }, { value: 'any', label: 'Either' },
            ]} />
          </Field>
          <Field label="contains" hint={contains.trim() ? `${matches.length} other transaction${matches.length === 1 ? '' : 's'} will change` : 'Enter some text to match'}>
            <input value={contains} onChange={(e) => setContains(e.target.value)} className={inputCls} />
          </Field>
          <div className="flex flex-col gap-2">
            <Button onClick={yes} disabled={!contains.trim()}>Yes, apply to all similar</Button>
            <Button variant="secondary" onClick={onDone}>Only this one</Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
