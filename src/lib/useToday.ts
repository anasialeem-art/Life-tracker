import { useEffect, useState } from 'react'
import { dayEnd, todayKey, type DayKey } from './day'

/**
 * Today's app day key. Re-renders at the 05:00 rollover and when the app comes
 * back to the foreground (Android freezes timers while it's in the background).
 */
export function useToday(): DayKey {
  const [today, setToday] = useState(todayKey)

  useEffect(() => {
    const refresh = () => setToday(todayKey())
    const ms = dayEnd(today).getTime() - Date.now()
    const timer = setTimeout(refresh, Math.max(ms, 0) + 1000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [today])

  return today
}
