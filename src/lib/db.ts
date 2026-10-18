import Dexie, { type EntityTable } from 'dexie'

// Single IndexedDB database for the whole app.
//
// Rules for every table so backups stay lossless as JSON:
//  - store dates as DayKey strings (YYYY-MM-DD) or epoch-ms numbers, never Date objects
//  - store only plain JSON values (no Maps, Sets, Blobs)
// Each later build step adds its tables with a new db.version(n).stores({...}).
// Backup export/import walks db.tables, so new tables are covered automatically.

export interface SettingRow {
  key: string
  value: unknown
}

/** Device-local bookkeeping that is not part of a backup (e.g. last backup time). */
export interface MetaRow {
  key: string
  value: unknown
}

export const db = new Dexie('life-tracker') as Dexie & {
  settings: EntityTable<SettingRow, 'key'>
  meta: EntityTable<MetaRow, 'key'>
}

db.version(1).stores({
  settings: 'key',
  meta: 'key',
})

/** Tables that are never exported or overwritten by an import. */
export const LOCAL_ONLY_TABLES = new Set(['meta'])

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

/** Record when the app was first opened (used for the backup reminder). */
export async function ensureFirstUse(): Promise<void> {
  if ((await getMeta('firstUsedAt')) === undefined) await setMeta('firstUsedAt', Date.now())
}
