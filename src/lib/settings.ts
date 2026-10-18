import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { DayKey } from './day'

export interface PrayerLocation { name: string; lat: number; lng: number }

export type CalcMethodKey =
  | 'MuslimWorldLeague' | 'Egyptian' | 'Karachi' | 'UmmAlQura' | 'Dubai' | 'MoonsightingCommittee'
  | 'NorthAmerica' | 'Kuwait' | 'Qatar' | 'Singapore' | 'Tehran' | 'Turkey'

export type HighLatRule = 'auto' | 'middleofthenight' | 'seventhofthenight' | 'twilightangle'

/** Cycle-mode position: on `day` the cycle is at split index `index`. Later anchors override earlier ones. */
export interface CycleAnchor { day: DayKey; index: number }

// Typed key-value settings with defaults.
export interface Settings {
  theme: 'system' | 'light' | 'dark'
  prayerLocation: PrayerLocation | null
  prayerMethod: CalcMethodKey
  asrMethod: 'shafi' | 'hanafi'
  highLatRule: HighLatRule
  /** Owed prayers carried in from before tracking, adjusted by the +/- buttons. */
  qadaBase: number
  /** First prayer day that counts towards automatic qada. */
  prayerTrackingStart: DayKey | null
  kcalTarget: number
  proteinTarget: number
  splitMode: 'weekday' | 'cycle'
  /** Weekday (0 = Sunday) → split day id. */
  weekdayPlan: Record<string, string | null>
  cycleAnchors: CycleAnchor[]
  currency: string
  defaultListId: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  prayerLocation: null,
  prayerMethod: 'MuslimWorldLeague',
  asrMethod: 'shafi',
  highLatRule: 'auto',
  qadaBase: 0,
  prayerTrackingStart: null,
  kcalTarget: 2500,
  proteinTarget: 160,
  splitMode: 'weekday',
  weekdayPlan: {},
  cycleAnchors: [],
  currency: '€',
  defaultListId: null,
}

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key)
  return (row?.value as Settings[K] | undefined) ?? DEFAULT_SETTINGS[key]
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value })
}

export async function getAllSettings(): Promise<Settings> {
  const rows = await db.settings.toArray()
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>
  for (const r of rows) if (r.value !== undefined) out[r.key] = r.value
  return out as unknown as Settings
}

/** Live setting value; returns the default until the first read resolves. */
export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useLiveQuery(() => getSetting(key), [key]) ?? DEFAULT_SETTINGS[key]
}

/** All settings live; undefined until loaded (lets pages avoid flashing defaults). */
export function useSettings(): Settings | undefined {
  return useLiveQuery(getAllSettings)
}
