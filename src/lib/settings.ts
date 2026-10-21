import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext } from 'react'
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
  /** Last page open in the Quran reader. */
  quranLastPage: number
  quranDailyGoal: number
  /** Start of the current khatma (epoch ms); pages read since then count towards it. */
  quranKhatmaStart: number | null
  quranKhatmasCompleted: number
  quranFontSize: number
  /** Days added to the calculated Hijri date to match local moon sighting. */
  hijriOffset: number
  /** Fasts owed from before tracking, adjusted manually. */
  qadaFastBase: number
  /** First day missed Ramadan fasts count from automatically. */
  fastingTrackingStart: DayKey | null
  semesterStart: DayKey | null
  semesterEnd: DayKey | null
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
  quranLastPage: 1,
  quranDailyGoal: 4,
  quranKhatmaStart: null,
  quranKhatmasCompleted: 0,
  quranFontSize: 26,
  hijriOffset: 0,
  qadaFastBase: 0,
  fastingTrackingStart: null,
  semesterStart: null,
  semesterEnd: null,
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

/**
 * Settings are read once at the app root and shared, so switching tabs never
 * waits on a database read before it can draw.
 */
export const SettingsContext = createContext<Settings | undefined>(undefined)

/** The root's single live query; App passes the result into SettingsContext. */
export function useSettingsQuery(): Settings | undefined {
  return useLiveQuery(getAllSettings)
}

/** All settings; undefined only during the very first load. */
export function useSettings(): Settings | undefined {
  return useContext(SettingsContext)
}

/** One setting; the default until the first load resolves. */
export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useContext(SettingsContext)?.[key] ?? DEFAULT_SETTINGS[key]
}
