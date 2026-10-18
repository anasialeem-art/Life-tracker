import { useEffect, useState } from 'react'

/**
 * Asks the browser not to evict our IndexedDB data under storage pressure.
 * Chrome on Android grants this automatically for installed PWAs.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export function usePersisted(): boolean | null {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(false))
  }, [])
  return persisted
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return online
}

/** True when launched from the home-screen icon rather than a browser tab. */
export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches
}
