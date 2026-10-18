import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import {
  BACKUP_REMINDER_DAYS, canShareFiles, exportBackup, readBackupFile, restoreBackup, summarize, type BackupFile,
} from '../lib/backup'
import { getMeta } from '../lib/db'
import { DownloadIcon, ShareIcon, UploadIcon } from '../components/Icons'
import { Sheet } from '../components/Sheet'
import { TopBar } from '../components/TopBar'
import { Button, Card, Page, SectionLabel } from '../components/ui'

const fmt = (d: Date) => d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export function Backup() {
  const lastBackupAt = useLiveQuery(() => getMeta<number>('lastBackupAt'))
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const share = canShareFiles()

  const runExport = async (mode: 'share' | 'download') => {
    setMessage(null)
    try {
      const result = await exportBackup(mode)
      if (result !== 'cancelled') setMessage({ text: result === 'shared' ? 'Backup shared.' : 'Backup saved to Downloads.' })
    } catch (e) {
      setMessage({ text: `Export failed: ${(e as Error).message}`, error: true })
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setMessage(null)
    try {
      setPending(await readBackupFile(file))
    } catch (e) {
      setMessage({ text: (e as Error).message, error: true })
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const confirmRestore = async () => {
    if (!pending) return
    setBusy(true)
    try {
      await restoreBackup(pending)
      setMessage({ text: 'Backup restored.' })
      setPending(null)
    } catch (e) {
      setMessage({ text: `Restore failed, nothing was changed: ${(e as Error).message}`, error: true })
    } finally {
      setBusy(false)
    }
  }

  const summary = pending && summarize(pending)

  return (
    <>
      <TopBar title="Backup" backTo="/more" />
      <Page>
        <Card>
          <p className="text-sm text-muted">Last backup</p>
          <p className="text-[17px] font-semibold">{lastBackupAt ? fmt(new Date(lastBackupAt)) : 'Never'}</p>
          <p className="mt-1 text-xs text-muted">You’ll get a reminder on Home after {BACKUP_REMINDER_DAYS} days without one.</p>
        </Card>

        <SectionLabel>Export</SectionLabel>
        <Card className="flex flex-col gap-2">
          <p className="pb-1 text-sm text-muted">Saves all your data as one JSON file. Save it to Drive or send it to yourself.</p>
          {share && <Button onClick={() => runExport('share')}><ShareIcon size={20} /> Share backup file</Button>}
          <Button variant={share ? 'secondary' : 'primary'} onClick={() => runExport('download')}><DownloadIcon size={20} /> Download backup file</Button>
        </Card>

        <SectionLabel>Restore</SectionLabel>
        <Card className="flex flex-col gap-2">
          <p className="pb-1 text-sm text-muted">Replaces everything in the app with the contents of a backup file.</p>
          <Button variant="secondary" onClick={() => fileInput.current?.click()}><UploadIcon size={20} /> Choose backup file</Button>
          <input ref={fileInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </Card>

        {message && (
          <p role="status" className={`animate-fade-in px-1 text-sm font-medium ${message.error ? 'text-danger' : 'text-success'}`}>{message.text}</p>
        )}
      </Page>

      <Sheet open={!!pending} onClose={() => setPending(null)} title="Restore this backup?">
        {summary && (
          <div className="flex flex-col gap-4">
            <p className="text-[15px] text-muted">
              Exported {fmt(summary.exportedAt)} · {summary.rows} records.
              <br />All current data in the app will be replaced. This can’t be undone.
            </p>
            <Button variant="danger" onClick={confirmRestore} disabled={busy}>{busy ? 'Restoring…' : 'Replace my data'}</Button>
            <Button variant="secondary" onClick={() => setPending(null)} disabled={busy}>Cancel</Button>
          </div>
        )}
      </Sheet>
    </>
  )
}
