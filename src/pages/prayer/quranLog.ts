import { db, uid } from '../../lib/db'
import { todayKey } from '../../lib/day'
import { TOTAL_PAGES } from '../../lib/quran'
import { getSetting, setSetting } from '../../lib/settings'

/**
 * Logs pages read. The reader logs each page at most once a day; manual
 * entries (physical mushaf) always add. Returns true when this completed a
 * khatma, which bumps the counter and starts the next one.
 */
export async function logQuranPages(pages: number[], source: 'reader' | 'manual'): Promise<boolean> {
  const day = todayKey()
  const now = Date.now()
  let completed = false
  await db.transaction('rw', db.quranReads, db.settings, async () => {
    for (const page of pages) {
      const id = source === 'reader' ? `${day}|r|${page}` : uid()
      if (source === 'reader' && (await db.quranReads.get(id))) continue
      await db.quranReads.put({ id, day, page, source, at: now })
    }
    const start = (await getSetting('quranKhatmaStart')) ?? 0
    const reads = await db.quranReads.where('at').aboveOrEqual(start).toArray()
    if (new Set(reads.map((r) => r.page)).size >= TOTAL_PAGES) {
      completed = true
      await setSetting('quranKhatmasCompleted', (await getSetting('quranKhatmasCompleted')) + 1)
      await setSetting('quranKhatmaStart', now + 1)
    }
  })
  return completed
}
