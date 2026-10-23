import { useEffect, useState } from 'react'
import { navigate } from '../../lib/router'
import { AlertIcon, LockIcon, PhoneIcon } from '../../components/Icons'
import { Sheet } from '../../components/Sheet'
import { Button, TextInput } from '../../components/ui'
import type { useBankSync } from './useBankSync'

/** The sync flow: PIN prompt, progress, "approve in photoTAN app", TAN entry and errors. */
export function SyncSheet({ sync }: { sync: ReturnType<typeof useBankSync> }) {
  const { state } = sync
  const [pin, setPin] = useState('')
  const [tan, setTan] = useState('')
  const open = state.phase !== 'idle' && state.phase !== 'done'
  const busy = state.phase === 'running' || state.phase === 'waiting' || state.phase === 'tan'

  useEffect(() => {
    if (state.phase === 'pin') setPin('')
    if (state.phase === 'tan') setTan('')
  }, [state.phase])

  const close = () => (busy ? sync.cancel() : sync.reset())
  const title = state.phase === 'pin' ? 'Enter your PIN' : state.phase === 'waiting' ? 'Approve in photoTAN' : state.phase === 'tan' ? 'Enter TAN'
    : state.phase === 'error' ? 'Sync failed' : 'Syncing'

  return (
    <Sheet open={open} onClose={close} title={title}>
      {state.phase === 'pin' && (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (pin) sync.start(pin) }}>
          <div className="flex justify-center"><span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent"><LockIcon size={26} /></span></div>
          <p className="text-center text-[15px] text-muted">Your Commerzbank PIN is not saved on this phone. It is used for this sync only.</p>
          <TextInput type="password" inputMode="text" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" autoFocus />
          <Button type="submit" disabled={!pin}>Sync</Button>
        </form>
      )}

      {state.phase === 'running' && (
        <div className="flex flex-col items-center gap-4 py-6">
          <span className="h-12 w-12 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
          <p className="text-[16px] font-semibold">{state.step}</p>
          <p className="max-w-72 text-center text-[13px] text-muted">Read-only: the app only downloads your balance and transactions.</p>
          <Button variant="secondary" className="w-full" onClick={sync.cancel}>Cancel</Button>
        </div>
      )}

      {state.phase === 'waiting' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <span className="relative my-3 flex h-24 w-24 items-center justify-center">
            <span className="animate-halo absolute inset-0 rounded-full bg-accent/25" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent text-white shadow-[0_10px_30px_-10px_var(--accent)]">
              <PhoneIcon size={36} />
            </span>
          </span>
          <p className="text-center text-[20px] font-bold">Approve in the photoTAN app</p>
          <p className="max-w-80 text-center text-[15px] leading-relaxed text-muted">
            Open the Commerzbank photoTAN app and confirm the request. This screen carries on by itself once you have approved.
          </p>
          {state.challenge && <p className="max-w-80 rounded-2xl bg-surface-2 px-4 py-3 text-center text-[13px] text-muted">{state.challenge}</p>}
          <p className="flex items-center gap-2 text-[13px] text-muted"><span className="h-2 w-2 animate-pulse-dot rounded-full bg-accent" /> Waiting for approval…</p>
          <Button variant="secondary" className="w-full" onClick={sync.cancel}>Cancel</Button>
        </div>
      )}

      {state.phase === 'tan' && (
        <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (tan.trim()) sync.submitTan(tan) }}>
          {state.photo && <img src={state.photo} alt="photoTAN code" className="mx-auto w-56 rounded-2xl bg-white p-2" />}
          <p className="text-center text-[15px] text-muted">{state.challenge || 'Scan the code with the photoTAN app and enter the TAN it shows.'}</p>
          <TextInput value={tan} onChange={(e) => setTan(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="TAN" autoFocus />
          <Button type="submit" disabled={!tan.trim()}>Confirm</Button>
          <Button variant="secondary" onClick={sync.cancel}>Cancel</Button>
        </form>
      )}

      {state.phase === 'error' && (
        <div className="flex flex-col items-center gap-4 py-4">
          <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${state.kind === 'setup' ? 'bg-accent-soft text-accent' : 'bg-danger-soft text-danger'}`}>
            <AlertIcon size={28} />
          </span>
          <p className="max-w-80 text-center text-[16px] leading-relaxed">{state.message}</p>
          <p className="text-center text-[13px] text-muted">Your existing data is unchanged.</p>
          <div className="flex w-full flex-col gap-2">
            {['setup', 'pin', 'product', 'account'].includes(state.kind)
              ? <Button onClick={() => { sync.reset(); navigate('/more/finance/settings') }}>Open Finance settings</Button>
              : state.kind !== 'locked' && <Button onClick={() => sync.start()}>Try again</Button>}
            <Button variant="secondary" onClick={sync.reset}>Close</Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}
