import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'

// Typed key-value settings. Add new keys here with their default as later steps need them.
export interface Settings {
  theme: 'system' | 'light' | 'dark'
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
}

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key)
  return (row?.value as Settings[K] | undefined) ?? DEFAULT_SETTINGS[key]
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value })
}

/** Live setting value; returns the default until the first read resolves. */
export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useLiveQuery(() => getSetting(key), [key]) ?? DEFAULT_SETTINGS[key]
}
