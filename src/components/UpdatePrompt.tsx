import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Registers the service worker. A new version waits until the user taps
 * Reload, so an update never interrupts a half-filled form.
 */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 4000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="animate-fade-in fixed inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-text px-4 py-3 text-bg shadow-xl">
      <p className="flex-1 text-sm font-medium">{needRefresh ? 'A new version is ready.' : 'Ready to work offline.'}</p>
      {needRefresh && (
        <button type="button" onClick={() => updateServiceWorker(true)} className="pressable rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white">
          Reload
        </button>
      )}
    </div>
  )
}
