import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { commitRows } from '../../lib/bankSync'
import { formatEUR } from '../../lib/finance'
import { ImportError, parseStatementFile, type ParsedStatement } from '../../lib/statementImport'
import { AlertIcon, UploadIcon } from '../../components/Icons'
import { Sheet } from '../../components/Sheet'
import { Button } from '../../components/ui'

export interface ImportHandle { pick: () => void }

type State =
  | { phase: 'idle' }
  | { phase: 'reading' }
  | { phase: 'preview'; name: string; parsed: ParsedStatement; fresh: number }
  | { phase: 'error'; message: string }

const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Pick a statement file (CSV or MT940), preview what's new, then add it. Opened via ref.pick(). */
export const ImportSheet = forwardRef<ImportHandle, { onImported: (added: number) => void }>(function ImportSheet({ onImported }, ref) {
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<State>({ phase: 'idle' })
  useImperativeHandle(ref, () => ({ pick: () => input.current?.click() }))

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = ''
    if (!file) return
    setState({ phase: 'reading' })
    try {
      const parsed = await parseStatementFile(await file.arrayBuffer())
      const { added } = await commitRows(parsed.rows, 'import', { dryRun: true })
      setState({ phase: 'preview', name: file.name, parsed, fresh: added })
    } catch (e) {
      setState({ phase: 'error', message: e instanceof ImportError ? e.message : `This file could not be read (${(e as Error).message}).` })
    }
  }

  const confirm = async () => {
    if (state.phase !== 'preview') return
    setState({ phase: 'reading' })
    try {
      const { added } = await commitRows(state.parsed.rows, 'import', { balance: state.parsed.balance })
      setState({ phase: 'idle' })
      onImported(added)
    } catch (e) {
      setState({ phase: 'error', message: `Import failed: ${(e as Error).message}. Nothing was changed.` })
    }
  }

  const close = () => setState({ phase: 'idle' })
  const p = state.phase === 'preview' ? state.parsed : null
  const days = p ? p.rows.map((r) => r.day).sort() : []
  const total = p ? p.rows.reduce((n, r) => n + r.amount, 0) : 0

  return (
    <>
      {/* No accept filter: Android's picker would hide .sta and some .csv files. */}
      <input ref={input} type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <Sheet open={state.phase !== 'idle'} onClose={close} title={state.phase === 'error' ? 'Import failed' : 'Import statement'}>
        {state.phase === 'reading' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <span className="h-12 w-12 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
            <p className="text-[16px] font-semibold">Reading file…</p>
          </div>
        )}
        {state.phase === 'preview' && p && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"><UploadIcon size={22} /></span>
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold">{state.name}</span>
                <span className="block text-[13px] text-muted">{p.format === 'csv' ? 'CSV export' : 'MT940 statement'} · {fmtDay(days[0])} – {fmtDay(days.at(-1)!)}</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-surface-2 p-3">
                <p className="text-[26px] font-bold tabular text-accent">{state.fresh}</p>
                <p className="text-[13px] text-muted">new</p>
              </div>
              <div className="rounded-2xl bg-surface-2 p-3">
                <p className="text-[26px] font-bold tabular">{p.rows.length - state.fresh}</p>
                <p className="text-[13px] text-muted">already in the app</p>
              </div>
            </div>
            <p className="text-center text-[13px] leading-relaxed text-muted">
              {p.rows.length} transactions in the file, {formatEUR(total, { sign: true })} in total.
              {p.skipped > 0 && ` ${p.skipped} line${p.skipped === 1 ? ' was' : 's were'} not transactions and will be left out.`}
              {' '}New ones are sorted by your rules; nothing already here is changed.
            </p>
            <Button onClick={confirm} disabled={state.fresh === 0}>
              {state.fresh === 0 ? 'Nothing new to import' : `Import ${state.fresh} transaction${state.fresh === 1 ? '' : 's'}`}
            </Button>
            <Button variant="secondary" onClick={close}>Cancel</Button>
          </div>
        )}
        {state.phase === 'error' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-soft text-danger"><AlertIcon size={28} /></span>
            <p className="max-w-80 text-center text-[16px] leading-relaxed">{state.message}</p>
            <p className="max-w-80 text-center text-[13px] text-muted">
              In Commerzbank online banking: Umsätze → Export → CSV. MT940 (.sta) files work too.
            </p>
            <div className="flex w-full flex-col gap-2">
              <Button onClick={() => input.current?.click()}>Choose another file</Button>
              <Button variant="secondary" onClick={close}>Close</Button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
})
