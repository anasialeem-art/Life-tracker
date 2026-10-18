import { useEffect, useRef, useState } from 'react'
import type { DayKey } from './day'

/** Current time, re-rendering every `ms` (and when the app returns to the foreground). */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setNow(new Date())
    const t = setInterval(tick, ms)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [ms])
  return now
}

/** Selected day for a page; follows "today" across a rollover while it's being viewed. */
export function useSelectedDay(today: DayKey): [DayKey, (d: DayKey) => void] {
  const [day, setDay] = useState(today)
  const prevToday = useRef(today)
  useEffect(() => {
    if (prevToday.current !== today) {
      setDay((d) => (d === prevToday.current ? today : d))
      prevToday.current = today
    }
  }, [today])
  return [day, setDay]
}

/** A moment on `day` at the current clock time, for logging retroactively. */
export function momentOn(day: DayKey, today: DayKey): number {
  if (day === today) return Date.now()
  const [y, m, d] = day.split('-').map(Number)
  const now = new Date()
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes()).getTime()
}
