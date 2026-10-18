import type { Recurrence, Task } from './db'
import { addDays, calendarKey, parseKey, weekdayOf, type DayKey } from './day'

export const LIST_COLORS = ['#0a84ff', '#ff9f0a', '#30d158', '#ff375f', '#bf5af2', '#64d2ff', '#ffd60a', '#ac8e68']
export const LIST_ICONS = ['🏠', '💼', '🎓', '🛒', '💪', '📚', '✈️', '💡', '🧹', '❤️', '🎯', '🕌']

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function addMonths(key: DayKey, n: number, anchorDay: number): DayKey {
  const d = parseKey(key)
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return calendarKey(new Date(target.getFullYear(), target.getMonth(), Math.min(anchorDay, lastDay)))
}

function step(key: DayKey, r: Recurrence, anchorDay: number): DayKey {
  switch (r.type) {
    case 'daily': return addDays(key, 1)
    case 'weekly': return addDays(key, 7)
    case 'monthly': return addMonths(key, 1, anchorDay)
    case 'yearly': return addMonths(key, 12, anchorDay)
    case 'weekdays': {
      if (!r.days.length) return addDays(key, 1)
      let d = addDays(key, 1)
      while (!r.days.includes(weekdayOf(d))) d = addDays(d, 1)
      return d
    }
  }
}

/**
 * Due date of the occurrence after completing one due on `due`. Skips ahead
 * past missed occurrences so a long-overdue daily task comes back as today.
 */
export function nextOccurrence(due: DayKey | null, r: Recurrence, today: DayKey): DayKey {
  const start = due ?? today
  const anchorDay = parseKey(start).getDate()
  let next = step(start, r, anchorDay)
  while (next < today) next = step(next, r, anchorDay)
  return next
}

export function isOverdue(t: Pick<Task, 'due' | 'time' | 'done'>, today: DayKey, now = new Date()): boolean {
  if (t.done || !t.due) return false
  if (t.due < today) return true
  if (t.due === today && t.time) {
    const [h, m] = t.time.split(':').map(Number)
    const due = parseKey(t.due)
    due.setHours(h, m)
    return now > due
  }
  return false
}

export function describeRecurrence(r: Recurrence | null): string {
  if (!r) return 'Never'
  switch (r.type) {
    case 'daily': return 'Every day'
    case 'weekly': return 'Every week'
    case 'monthly': return 'Every month'
    case 'yearly': return 'Every year'
    case 'weekdays': return r.days.length === 7 ? 'Every day' : [...r.days].sort().map((d) => WEEKDAY_SHORT[d]).join(', ')
  }
}

/** Sort: overdue/dated first by date+time, then undated by creation; high priority wins ties. */
export function compareTasks(a: Task, b: Task): number {
  if (a.done !== b.done) return a.done ? 1 : -1
  if (a.done && b.done) return (b.doneAt ?? 0) - (a.doneAt ?? 0)
  const ad = a.due ? `${a.due} ${a.time ?? '99:99'}` : '9999'
  const bd = b.due ? `${b.due} ${b.time ?? '99:99'}` : '9999'
  if (ad !== bd) return ad < bd ? -1 : 1
  if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1
  return a.createdAt - b.createdAt
}

export function dueLabel(due: DayKey, today: DayKey): string {
  if (due === today) return 'Today'
  if (due === addDays(today, 1)) return 'Tomorrow'
  if (due === addDays(today, -1)) return 'Yesterday'
  const d = parseKey(due)
  const sameYear = d.getFullYear() === parseKey(today).getFullYear()
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}
