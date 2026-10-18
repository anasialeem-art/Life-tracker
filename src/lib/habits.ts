import type { Habit, HabitCheck } from './db'
import { addDays, dayKeyAt, weekdayOf, type DayKey } from './day'

/** Monday-based week containing the day. */
export function weekOf(day: DayKey): DayKey[] {
  const monday = addDays(day, -((weekdayOf(day) + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Whether a habit appears on a day. "X times per week" habits show every day until the week's goal is met (and on days they were checked). */
export function habitShownOn(h: Habit, day: DayKey): boolean {
  if (h.archived) return false
  if (day < dayKeyAt(new Date(h.createdAt))) return false
  if (h.frequency.type === 'weekdays') return h.frequency.days.includes(weekdayOf(day))
  return true
}

export function weekCount(h: Habit, checks: HabitCheck[], day: DayKey): number {
  const week = new Set(weekOf(day))
  return checks.filter((c) => c.habitId === h.id && week.has(c.day)).length
}

export function describeFrequency(h: Habit): string {
  const f = h.frequency
  if (f.type === 'daily') return 'Every day'
  if (f.type === 'perweek') return `${f.times}× per week`
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const order = [1, 2, 3, 4, 5, 6, 0]
  return order.filter((d) => f.days.includes(d)).map((d) => names[d]).join(' · ')
}

export const HABIT_ICONS = ['💧', '📖', '🏃', '🧘', '🦷', '😴', '🥗', '🚶', '🧴', '💊', '📵', '✍️', '🌅', '🧠', '🎸', '🕌', '📿', '🚿', '🍎', '☕️']
