import { db, getMeta, LOCAL_ONLY_TABLES, setMeta } from './db'
import { calendarKey } from './day'

export const BACKUP_APP_ID = 'life-tracker'
export const BACKUP_REMINDER_DAYS = 14

export interface BackupFile {
  app: typeof BACKUP_APP_ID
  schemaVersion: number
  exportedAt: string
  tables: Record<string, unknown[]>
}

function backupTables() {
  return db.tables.filter((t) => !LOCAL_ONLY_TABLES.has(t.name))
}

export async function buildBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {}
  await db.transaction('r', backupTables(), async () => {
    for (const t of backupTables()) tables[t.name] = await t.toArray()
  })
  return { app: BACKUP_APP_ID, schemaVersion: db.verno, exportedAt: new Date().toISOString(), tables }
}

export function backupFileName(now = new Date()): string {
  return `life-tracker-backup-${calendarKey(now)}.json`
}

export type ExportResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * Exports all data as one JSON file. On Android the share sheet lets the user
 * save straight to Drive or send it to themselves; otherwise it downloads.
 */
export async function exportBackup(mode: 'share' | 'download'): Promise<ExportResult> {
  const data = await buildBackup()
  const file = new File([JSON.stringify(data, null, 2)], backupFileName(), { type: 'application/json' })

  if (mode === 'share' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Life Tracker backup' })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
      throw e
    }
    await setMeta('lastBackupAt', Date.now())
    return 'shared'
  }

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  await setMeta('lastBackupAt', Date.now())
  return 'downloaded'
}

export function canShareFiles(): boolean {
  try {
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' })
    return !!navigator.canShare?.({ files: [probe] })
  } catch {
    return false
  }
}

/** Parses and validates a backup file without touching the database. */
export async function readBackupFile(file: File): Promise<BackupFile> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  const b = parsed as Partial<BackupFile>
  if (!b || b.app !== BACKUP_APP_ID || typeof b.tables !== 'object' || b.tables === null) {
    throw new Error('This is not a Life Tracker backup file.')
  }
  if (typeof b.schemaVersion !== 'number' || b.schemaVersion > db.verno) {
    throw new Error('This backup comes from a newer version of the app. Update the app first.')
  }
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!Array.isArray(rows)) throw new Error(`Backup table "${name}" is malformed.`)
  }
  return b as BackupFile
}

export function summarize(b: BackupFile): { rows: number; exportedAt: Date } {
  const rows = Object.values(b.tables).reduce((n, r) => n + r.length, 0)
  return { rows, exportedAt: new Date(b.exportedAt) }
}

/**
 * Full restore: every backed-up table is cleared and replaced with the file's
 * contents in one transaction, so a failure leaves the current data intact.
 * Tables missing from an older backup end up empty.
 */
export async function restoreBackup(b: BackupFile): Promise<void> {
  const tables = backupTables()
  await db.transaction('rw', tables, async () => {
    for (const t of tables) {
      await t.clear()
      const rows = b.tables[t.name]
      if (rows?.length) await t.bulkPut(rows)
    }
  })
  // A restored file is by definition backed up as of its export time.
  await setMeta('lastBackupAt', new Date(b.exportedAt).getTime() || Date.now())
}

/** Days since the last backup (or since first use if never backed up), or null if not yet due. */
export async function backupOverdueDays(now = Date.now()): Promise<number | null> {
  const last = (await getMeta<number>('lastBackupAt')) ?? (await getMeta<number>('firstUsedAt'))
  if (last === undefined) return null
  const days = Math.floor((now - last) / 86_400_000)
  return days >= BACKUP_REMINDER_DAYS ? days : null
}
