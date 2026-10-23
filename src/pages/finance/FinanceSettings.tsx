import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, getMeta } from '../../lib/db'
import { resetBankState } from '../../lib/bankSync'
import { CATEGORY_META, PAID_CATEGORIES, SPEND_CATEGORIES, blzFromIban, normIban, parseEUR, recategorizeAll } from '../../lib/finance'
import { forgetCredentials, isNativeApp, loadCredentials, saveCredentials } from '../../lib/native'
import { navigate } from '../../lib/router'
import { setSetting, useSettings } from '../../lib/settings'
import { CheckIcon, ChevronRight, ListIcon, LockIcon, NoteIcon, PlusIcon, TrashIcon, XIcon } from '../../components/Icons'
import { ConfirmSheet, Sheet } from '../../components/Sheet'
import { TopBar } from '../../components/TopBar'
import { Button, Field, Group, Page, Row, SectionLabel, TextInput, Toggle, useToast } from '../../components/ui'
import { CategoryBadge, timeAgo } from './parts'
import { getBankSetup, setBankSetup, type SyncLog } from './useBankSync'

export function FinanceSettings() {
  const s = useSettings()
  const native = isNativeApp()
  const rules = useLiveQuery(() => db.finRules.count()) ?? 0
  const bank = useLiveQuery(() => getMeta<{ tanMethods?: { id: number; name: string; decoupled: boolean }[]; tanMethodId?: number | null }>('finBank'))
  const log = useLiveQuery(() => getMeta<SyncLog>('finSyncLog'))
  const [open, setOpen] = useState<null | 'tan' | 'log' | 'reset' | 'disconnect'>(null)
  const [toast, showToast] = useToast()
  if (!s) return <TopBar title="Finance settings" backTo="/more/finance" />
  const methods = bank?.tanMethods ?? []
  const activeMethod = methods.find((m) => m.id === (s.finTanMethodId ?? bank?.tanMethodId))

  return (
    <>
      <TopBar title="Finance settings" backTo="/more/finance" />
      <Page>
        <SectionLabel>Commerzbank</SectionLabel>
        <ConnectionForm native={native} onSaved={() => showToast('Saved')} />

        <SectionLabel>Monthly limits</SectionLabel>
        <Group>
          {SPEND_CATEGORIES.map((c) => (
            <LimitRow key={c} category={c} value={s.finLimits?.[c] ?? 0}
              onSave={(cents) => setSetting('finLimits', { ...s.finLimits, [c]: cents })} />
          ))}
        </Group>
        <p className="px-4 text-[12px] text-muted">Limits reset on the 1st of every month, with no rollover. For Subscriptions and Gym, a full bar means paid this month; leave Subscriptions empty to use the detected total.</p>

        <SectionLabel>Categories</SectionLabel>
        <Group>
          <Row icon={<ListIcon size={18} />} label="Rules" detail={String(rules)} onClick={() => navigate('/more/finance/rules')}><ChevronRight size={18} className="text-faint" /></Row>
          <OwnIbansRow ibans={s.finOwnIbans} />
        </Group>

        <SectionLabel>Bank connection</SectionLabel>
        <Group>
          <Row icon={<LockIcon size={18} />} label="TAN method" onClick={methods.length ? () => setOpen('tan') : undefined}
            detail={activeMethod ? activeMethod.name : methods.length ? 'Automatic' : 'After first sync'}>
            {methods.length > 0 && <ChevronRight size={18} className="text-faint" />}
          </Row>
          <Row icon={<NoteIcon size={18} />} label="Last sync log" onClick={log ? () => setOpen('log') : undefined}
            detail={log ? `${log.ok ? 'OK' : 'Failed'} · ${timeAgo(log.at)}` : 'None yet'}>
            {log && <ChevronRight size={18} className="text-faint" />}
          </Row>
          {native && methods.length > 0 && <Row label="Reset bank connection" onClick={() => setOpen('reset')} />}
          {native && <Row label="Disconnect and forget login" danger onClick={() => setOpen('disconnect')} />}
        </Group>
        <p className="px-4 pb-4 text-[12px] leading-relaxed text-muted">
          Read-only: the app only downloads your balance and booked transactions. It contains no code for payments or transfers. Everything stays on this phone.
        </p>
      </Page>

      <Sheet open={open === 'tan'} onClose={() => setOpen(null)} title="TAN method">
        <div className="flex flex-col gap-1.5">
          {[{ id: null as number | null, name: 'Automatic (recommended)', decoupled: false }, ...methods].map((m) => (
            <button key={String(m.id)} type="button" onClick={() => { setSetting('finTanMethodId', m.id); setOpen(null) }}
              className={`pressable flex min-h-[54px] items-center justify-between rounded-2xl px-4 text-left text-[16px] ${s.finTanMethodId === m.id ? 'bg-accent-soft font-semibold text-accent' : 'bg-surface-2'}`}>
              <span>{m.name}{m.id !== null && <span className="block text-[12px] font-normal text-muted">#{m.id}{m.decoupled ? ' · approve in app' : ''}</span>}</span>
              {s.finTanMethodId === m.id && <CheckIcon size={20} strokeWidth={2.8} />}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={open === 'log'} onClose={() => setOpen(null)} title="Last sync log">
        <p className="pb-2 text-[13px] text-muted">Contains no PIN or TAN. Screenshot this if a sync fails and you want help.</p>
        <pre className="rounded-2xl bg-surface-2 p-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words select-text">{log?.lines.join('\n')}</pre>
      </Sheet>

      <ConfirmSheet open={open === 'reset'} onClose={() => setOpen(null)} title="Reset bank connection?" danger={false}
        message="The next sync signs in to Commerzbank from scratch and asks for a new approval. Use this if syncs keep failing with a bank error. Your login, PIN and transactions stay."
        confirmLabel="Reset" onConfirm={async () => { await resetBankState(); showToast('Connection reset') }} />
      <ConfirmSheet open={open === 'disconnect'} onClose={() => setOpen(null)} title="Disconnect Commerzbank?"
        message="Your login and PIN are removed from this phone and the bank connection is reset. Your synced transactions stay."
        confirmLabel="Disconnect" onConfirm={async () => {
          await forgetCredentials()
          await resetBankState()
          window.dispatchEvent(new Event('finance:credentials'))
          showToast('Disconnected')
        }} />
      {toast}
    </>
  )
}

function ConnectionForm({ native, onSaved }: { native: boolean; onSaved: () => void }) {
  const s = useSettings()
  const [productId, setProductId] = useState(s?.finProductId ?? '')
  const [iban, setIban] = useState('')
  const [login, setLogin] = useState('')
  const [pin, setPin] = useState('')
  const [savePin, setSavePin] = useState(true)
  const [hasPin, setHasPin] = useState(false)
  const [loaded, setLoaded] = useState<{ iban: string; login: string } | null>(null)

  const load = async () => {
    const [setup, creds] = await Promise.all([getBankSetup(), loadCredentials()])
    setIban(setup?.iban ?? '')
    setLogin(creds.login ?? '')
    setHasPin(!!creds.pin)
    setSavePin(!!creds.pin || !creds.login)
    setPin('')
    setLoaded({ iban: setup?.iban ?? '', login: creds.login ?? '' })
  }
  useEffect(() => {
    load()
    const onChange = () => load()
    window.addEventListener('finance:credentials', onChange)
    return () => window.removeEventListener('finance:credentials', onChange)
  }, [])

  const ibanOk = blzFromIban(iban) !== null
  const changed = loaded && (productId.trim() !== (s?.finProductId ?? '') || normIban(iban) !== normIban(loaded.iban) || login.trim() !== loaded.login
    || pin !== '' || savePin !== hasPin)
  const canSave = native && productId.trim() && ibanOk && login.trim() && (pin || hasPin || !savePin) && changed

  const save = async () => {
    if (!loaded) return
    const loginChanged = login.trim() !== loaded.login || normIban(iban).slice(4, 12) !== normIban(loaded.iban).slice(4, 12)
    // Keep a stored PIN unless it is replaced or "save PIN" is switched off.
    const creds = await loadCredentials()
    const nextPin = savePin ? pin || (loginChanged ? null : creds.pin) : null
    await saveCredentials(login.trim(), nextPin)
    await setBankSetup({ iban: normIban(iban) })
    await setSetting('finProductId', productId.trim())
    if (loginChanged) {
      await resetBankState()
    }
    await load()
    onSaved()
  }

  return (
    <div className="flex flex-col gap-4 rounded-[22px] bg-surface p-4 shadow-card">
      {!native && (
        <p className="rounded-2xl bg-warning-soft px-4 py-3 text-[14px] font-medium text-warning">
          Bank details can only be stored in the Android app, in Android's secure storage.
        </p>
      )}
      <Field label="Product registration number" hint="Your FinTS registration number from the Deutsche Kreditwirtschaft (fints.org). Commerzbank requires it.">
        <TextInput value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="e.g. 9FA6681DEC0CF3046BFC2F8A6" autoCapitalize="characters" autoComplete="off" spellCheck={false} />
      </Field>
      <Field label="IBAN of your Girokonto" hint={iban && !ibanOk ? 'Enter a German IBAN (DE + 20 digits)' : undefined}>
        <TextInput value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="DE00 0000 0000 0000 0000 00" autoComplete="off" spellCheck={false} disabled={!native} />
      </Field>
      <Field label="Login number (Teilnehmernummer)">
        <TextInput value={login} onChange={(e) => setLogin(e.target.value.replace(/\s/g, ''))} inputMode="numeric" autoComplete="off" disabled={!native} />
      </Field>
      <div className="flex items-center gap-3 px-1">
        <span className="flex-1">
          <span className="block text-[16px]">Save PIN on this phone</span>
          <span className="block text-[12px] text-muted">{savePin ? 'Stored encrypted by Android' : 'You enter it on every sync'}</span>
        </span>
        <Toggle checked={savePin} onChange={setSavePin} disabled={!native} label="Save PIN" />
      </div>
      {savePin && (
        <Field label="PIN" hint={hasPin ? 'A PIN is saved. Type a new one only to change it.' : undefined}>
          <TextInput type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder={hasPin ? '•••••' : 'Online banking PIN'} autoComplete="off" disabled={!native} />
        </Field>
      )}
      <Button onClick={save} disabled={!canSave}>Save</Button>
    </div>
  )
}

function LimitRow({ category, value, onSave }: { category: (typeof SPEND_CATEGORIES)[number]; value: number; onSave: (cents: number) => void }) {
  const toText = (v: number) => (v ? (v / 100).toFixed(v % 100 ? 2 : 0).replace('.', ',') : '')
  const [text, setText] = useState(toText(value))
  useEffect(() => setText(toText(value)), [value])
  const commit = () => {
    const cents = parseEUR(text)
    if (cents === null) setText(toText(value))
    else if (cents !== value) onSave(cents)
  }
  const meta = CATEGORY_META[category]
  return (
    <Row icon={<CategoryBadge category={category} size={32} />} label={<>{meta.label}{PAID_CATEGORIES.includes(category) && <span className="block text-[12px] text-muted">Expected per month</span>}</>}>
      <span className="flex items-center gap-1.5">
        <span className="text-[15px] text-muted">€</span>
        <input value={text} inputMode="decimal" placeholder="—" onChange={(e) => setText(e.target.value.replace(/[^\d.,]/g, ''))} onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label={`${meta.label} limit`}
          className="h-10 w-24 rounded-xl bg-surface-2 text-center text-[16px] font-semibold outline-none tabular placeholder:text-faint focus:ring-2 focus:ring-accent/40" />
      </span>
    </Row>
  )
}

function OwnIbansRow({ ibans }: { ibans: string[] }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const valid = /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(normIban(text))
  const save = async (next: string[]) => {
    await setSetting('finOwnIbans', next)
    await recategorizeAll()
  }
  return (
    <>
      <Row icon={<span className="text-[15px]">↔️</span>} label="Your other accounts" detail={ibans.length ? String(ibans.length) : 'None'} onClick={() => setOpen(true)}>
        <ChevronRight size={18} className="text-faint" />
      </Row>
      <Sheet open={open} onClose={() => setOpen(false)} title="Your other accounts">
        <div className="flex flex-col gap-4">
          <p className="text-[14px] leading-relaxed text-muted">
            Money sent to these IBANs counts as a transfer, not spending. Payments to someone with your own name are also treated as transfers.
          </p>
          {ibans.length > 0 && (
            <div className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface-2/70">
              {ibans.map((i) => (
                <div key={i} className="flex min-h-[52px] items-center gap-2 pr-1 pl-4">
                  <span className="flex-1 font-mono text-[14px]">{i.replace(/(.{4})/g, '$1 ').trim()}</span>
                  <button type="button" aria-label="Remove" onClick={() => save(ibans.filter((x) => x !== i))}
                    className="pressable flex h-10 w-10 items-center justify-center text-danger"><TrashIcon size={18} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <TextInput value={text} onChange={(e) => setText(e.target.value.toUpperCase())} placeholder="IBAN" autoComplete="off" spellCheck={false} />
            <Button className="shrink-0" disabled={!valid} onClick={async () => { await save([...new Set([...ibans, normIban(text)])]); setText('') }}>
              <PlusIcon size={20} />
            </Button>
          </div>
          {text && !valid && <p className="flex items-center gap-1 text-[13px] text-muted"><XIcon size={14} /> Not a valid IBAN yet</p>}
          {ibans.length === 0 && <p className="text-center text-[13px] text-muted">No other accounts — that's fine, nothing to do here.</p>}
        </div>
      </Sheet>
    </>
  )
}
