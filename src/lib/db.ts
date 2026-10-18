import Dexie, { type EntityTable } from 'dexie'
import type { DayKey } from './day'

// Single IndexedDB database for the whole app.
//
// Rules for every table so backups stay lossless as JSON:
//  - store dates as DayKey strings (YYYY-MM-DD) or epoch-ms numbers, never Date objects
//  - store only plain JSON values (no Maps, Sets, Blobs)
// Backup export/import walks db.tables, so new tables are covered automatically.

export interface SettingRow { key: string; value: unknown }
/** Device-local bookkeeping that is not part of a backup (e.g. last backup time). */
export interface MetaRow { key: string; value: unknown }

// ---- Meds -------------------------------------------------------------------

export type MedPattern = 'daily' | 'alternate' | 'custom'

/** One version of a med's schedule. Edits append a version effective from today, so past days keep their old rules. */
export interface MedSchedule {
  effectiveFrom: DayKey
  pattern: MedPattern
  customDays: DayKey[]
  dosesPerDay: number
  startDate: DayKey
  endDate: DayKey | null
}

export interface Med {
  id: string
  name: string
  kind: 'scheduled' | 'asneeded'
  schedules: MedSchedule[]
  /** Hidden from this day on; earlier days keep showing it in history. */
  archivedFrom: DayKey | null
  order: number
  createdAt: number
}

/** A scheduled dose slot that was checked (slot ≥ 0), or one as-needed dose (slot = -1). */
export interface MedLog {
  id: string
  medId: string
  day: DayKey
  slot: number
  at: number
}

// ---- Prayer -------------------------------------------------------------------

export type PrayerName = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
export type PrayerStatus = 'ontime' | 'late' | 'qada'

export interface PrayerLog {
  id: string // `${day}|${prayer}`
  day: DayKey
  prayer: PrayerName
  status: PrayerStatus | null
  jamaah: boolean
}

/** Optional extras for a prayer day: sunnah prayers, witr and adhkar. Never count as missed. */
export interface PrayerExtras {
  day: DayKey
  done: Record<string, boolean>
}

// ---- To-Do --------------------------------------------------------------------

export interface TodoList {
  id: string
  name: string
  color: string
  icon: string
  order: number
  archived: boolean
}

export type Recurrence =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'weekly' }
  | { type: 'monthly' }
  | { type: 'yearly' }

export interface Subtask { id: string; title: string; done: boolean }

export interface Task {
  id: string
  listId: string
  title: string
  note: string
  due: DayKey | null
  time: string | null // HH:MM
  priority: 'high' | 'normal'
  subtasks: Subtask[]
  recurrence: Recurrence | null
  done: boolean
  doneAt: number | null
  createdAt: number
}

// ---- Fitness ------------------------------------------------------------------

export interface Exercise { id: string; name: string; sets: number | null; reps: string | null }

export interface SplitDay {
  id: string
  name: string
  rest: boolean
  exercises: Exercise[]
  order: number
}

/** What actually happened on a day: the trained flag and, in weekday mode, a one-off swap. */
export interface TrainingDay {
  day: DayKey
  splitDayId: string | null
  trained: boolean
}

export interface BodyWeight { day: DayKey; kg: number }

export interface NutritionEntry {
  id: string
  day: DayKey
  kind: 'kcal' | 'protein'
  amount: number
  at: number
}

/** One set from a Lyfta CSV export. */
export interface LyftaSet {
  id: string
  day: DayKey
  exercise: string
  weight: number
  reps: number
}

// ---- Habits, Money, Journal -----------------------------------------------------

export type HabitFrequency =
  | { type: 'daily' }
  | { type: 'weekdays'; days: number[] }
  | { type: 'perweek'; times: number }

export interface Habit {
  id: string
  name: string
  icon: string
  frequency: HabitFrequency
  order: number
  archived: boolean
  createdAt: number
}

export interface HabitCheck { id: string; habitId: string; day: DayKey }

export interface MoneyCategory { id: string; name: string; icon: string; order: number }

export interface Expense {
  id: string
  day: DayKey
  categoryId: string
  description: string
  /** Minor units (cents) to avoid float rounding. */
  amount: number
  createdAt: number
}

export interface JournalEntry {
  day: DayKey
  text: string
  mood: number | null
  updatedAt: number
}

// ---- Database -------------------------------------------------------------------

export const db = new Dexie('life-tracker') as Dexie & {
  settings: EntityTable<SettingRow, 'key'>
  meta: EntityTable<MetaRow, 'key'>
  meds: EntityTable<Med, 'id'>
  medLogs: EntityTable<MedLog, 'id'>
  prayerLogs: EntityTable<PrayerLog, 'id'>
  prayerExtras: EntityTable<PrayerExtras, 'day'>
  todoLists: EntityTable<TodoList, 'id'>
  tasks: EntityTable<Task, 'id'>
  splitDays: EntityTable<SplitDay, 'id'>
  trainingDays: EntityTable<TrainingDay, 'day'>
  bodyWeights: EntityTable<BodyWeight, 'day'>
  nutrition: EntityTable<NutritionEntry, 'id'>
  lyftaSets: EntityTable<LyftaSet, 'id'>
  habits: EntityTable<Habit, 'id'>
  habitChecks: EntityTable<HabitCheck, 'id'>
  moneyCategories: EntityTable<MoneyCategory, 'id'>
  expenses: EntityTable<Expense, 'id'>
  journal: EntityTable<JournalEntry, 'day'>
}

db.version(1).stores({
  settings: 'key',
  meta: 'key',
})

db.version(2).stores({
  meds: 'id, order',
  medLogs: 'id, day, medId',
  prayerLogs: 'id, day',
  prayerExtras: 'day',
  todoLists: 'id, order',
  tasks: 'id, listId, due',
  splitDays: 'id, order',
  trainingDays: 'day',
  bodyWeights: 'day',
  nutrition: 'id, day',
  lyftaSets: 'id, day, exercise',
  habits: 'id, order',
  habitChecks: 'id, day, habitId',
  moneyCategories: 'id, order',
  expenses: 'id, day, categoryId',
  journal: 'day',
})

/** Tables that are never exported or overwritten by an import. */
export const LOCAL_ONLY_TABLES = new Set(['meta'])

export const uid = () => crypto.randomUUID()

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

/** First-run setup: records first use (for the backup reminder) and seeds starter lists and categories. */
export async function ensureFirstUse(): Promise<void> {
  if ((await getMeta('firstUsedAt')) === undefined) await setMeta('firstUsedAt', Date.now())
  // Separate flag: phones that first ran the step-1 shell already have firstUsedAt.
  if (await getMeta('seededStarters')) return
  await setMeta('seededStarters', true)
  await db.transaction('rw', db.todoLists, db.moneyCategories, async () => {
    if ((await db.todoLists.count()) === 0) {
      await db.todoLists.bulkAdd([
        { id: uid(), name: 'Personal', color: '#0a84ff', icon: '🏠', order: 0, archived: false },
        { id: uid(), name: 'Work', color: '#ff9f0a', icon: '💼', order: 1, archived: false },
      ])
    }
    if ((await db.moneyCategories.count()) === 0) {
      const cats = [['Groceries', '🛒'], ['Eating out', '🍔'], ['Transport', '🚆'], ['Shopping', '🛍️'], ['Bills', '🧾'], ['Other', '📦']]
      await db.moneyCategories.bulkAdd(cats.map(([name, icon], order) => ({ id: uid(), name, icon, order })))
    }
  })
}
