import { useRef, useState } from 'react'
import { BankError, runSync, type BankErrorKind } from '../../lib/bankSync'
import { getMeta, setMeta } from '../../lib/db'
import { blzFromIban } from '../../lib/finance'
import { getAllSettings } from '../../lib/settings'
import { isNativeApp, loadCredentials } from '../../lib/native'

/** What the sync sheet shows. */
export type SyncState =
  | { phase: 'idle' }
  | { phase: 'pin' } // PIN not saved: ask for it
  | { phase: 'running'; step: string }
  | { phase: 'waiting'; challenge: string } // approve in the photoTAN app
  | { phase: 'tan'; challenge: string; photo: string | null } // type a TAN
  | { phase: 'done'; added: number }
  | { phase: 'error'; kind: BankErrorKind | 'unknown'; message: string }

export interface SyncLog { at: number; ok: boolean; lines: string[] }

/** The IBAN and similar non-secret connection details (device-local). */
export interface BankSetup { iban: string }

export async function getBankSetup(): Promise<BankSetup | null> {
  return (await getMeta<BankSetup>('finSetup')) ?? null
}

export async function setBankSetup(s: BankSetup): Promise<void> {
  await setMeta('finSetup', s)
}

let running = false

export function useBankSync() {
  const [state, setState] = useState<SyncState>({ phase: 'idle' })
  const abort = useRef<AbortController | null>(null)
  const tanAnswer = useRef<((tan: string | null) => void) | null>(null)

  const fail = (e: unknown) => {
    // Cancelling is the user's own choice; just close.
    if (e instanceof BankError && e.kind === 'tan-cancelled') setState({ phase: 'idle' })
    else if (e instanceof BankError) setState({ phase: 'error', kind: e.kind, message: e.message })
    else setState({ phase: 'error', kind: 'unknown', message: `Something went wrong: ${(e as Error)?.message ?? e}. Nothing was changed.` })
  }

  /** Starts a sync; asks for the PIN first when it is not saved. */
  const start = async (pinOnce?: string) => {
    if (running) return
    if (!isNativeApp()) {
      setState({ phase: 'error', kind: 'setup', message: 'Bank sync works in the Android app. Here you can still see everything synced so far.' })
      return
    }
    const [settings, setup, creds] = await Promise.all([getAllSettings(), getBankSetup(), loadCredentials()])
    if (!setup || !blzFromIban(setup.iban) || !creds.login) {
      setState({ phase: 'error', kind: 'setup', message: 'Finish connecting Commerzbank in Finance settings first.' })
      return
    }
    const pin = pinOnce ?? creds.pin
    if (!pin) {
      setState({ phase: 'pin' })
      return
    }

    running = true
    const ctrl = new AbortController()
    abort.current = ctrl
    const lines: string[] = []
    const log = (l: string) => lines.push(`${new Date().toLocaleTimeString('en-GB')} ${l}`)
    setState({ phase: 'running', step: 'Starting…' })
    let ok = false
    try {
      const { createFintsConnector } = await import('../../lib/fints')
      const connector = createFintsConnector(
        { productId: settings.finProductId, iban: setup.iban, login: creds.login, pin, tanMethodId: settings.finTanMethodId },
        {
          signal: ctrl.signal,
          step: (step) => { log(step); setState({ phase: 'running', step }) },
          waiting: (challenge) => { log('Waiting for photoTAN app approval'); setState({ phase: 'waiting', challenge }) },
          askTan: (challenge, photo) => new Promise((resolve) => {
            log('Asking for a TAN')
            const url = photo ? URL.createObjectURL(new Blob([photo.image as BlobPart], { type: photo.mimeType || 'image/png' })) : null
            tanAnswer.current = (tan) => {
              if (url) URL.revokeObjectURL(url)
              tanAnswer.current = null
              setState({ phase: 'running', step: 'Checking TAN…' })
              resolve(tan)
            }
            setState({ phase: 'tan', challenge, photo: url })
          }),
        },
        log,
      )
      const r = await runSync(connector)
      ok = true
      log(`Saved ${r.added} new of ${r.fetched} fetched`)
      setState({ phase: 'done', added: r.added })
    } catch (e) {
      log(`Failed: ${e instanceof BankError ? `${e.kind} ${e.message} ${e.detail}` : String(e)}`)
      fail(e)
    } finally {
      running = false
      abort.current = null
      await setMeta('finSyncLog', { at: Date.now(), ok, lines } satisfies SyncLog)
    }
  }

  return {
    state,
    start,
    cancel: () => {
      tanAnswer.current?.(null)
      abort.current?.abort()
    },
    submitTan: (tan: string) => tanAnswer.current?.(tan),
    reset: () => setState({ phase: 'idle' }),
  }
}
