import type { Exam, Lecture } from './db'
import { addDays, calendarKey, daysBetween, weekdayOf, type DayKey } from './day'

export const LECTURE_TYPES: { value: Lecture['type']; label: string }[] = [
  { value: 'lecture', label: 'Lecture' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'lab', label: 'Lab' },
]

export const COURSE_COLORS = ['#0a84ff', '#ff9f0a', '#30d158', '#ff375f', '#bf5af2', '#64d2ff', '#ffd60a', '#ac8e68', '#5e5ce6', '#ff6b35']

/** Stable color per course name when a lecture has none set. */
export function courseColor(course: string, explicit: string | null = null): string {
  if (explicit) return explicit
  let h = 0
  for (const c of course.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return COURSE_COLORS[h % COURSE_COLORS.length]
}

export function inSemester(day: DayKey, start: DayKey | null, end: DayKey | null): boolean {
  return !!start && !!end && day >= start && day <= end
}

export const byStart = (a: Lecture, b: Lecture) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0)

export function lecturesOn(lectures: Lecture[], day: DayKey): Lecture[] {
  return lectures.filter((l) => l.weekday === weekdayOf(day)).sort(byStart)
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export interface NextLecture { lecture: Lecture; day: DayKey; now: boolean }

/** The lecture happening now, or the next one within the semester (looking two weeks ahead). */
export function nextLecture(lectures: Lecture[], start: DayKey | null, end: DayKey | null, now = new Date()): NextLecture | null {
  const today = calendarKey(now)
  const time = hhmm(now)
  for (let i = 0; i < 15; i++) {
    const day = addDays(today, i)
    if (!inSemester(day, start, end)) continue
    for (const l of lecturesOn(lectures, day)) {
      if (i > 0 || l.end > time) return { lecture: l, day, now: i === 0 && l.start <= time }
    }
  }
  return null
}

export function upcomingExams(exams: Exam[], today: DayKey): Exam[] {
  return exams.filter((e) => e.date >= today).sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
}

/** "Today", "Tomorrow", "in 5 days", "3 days ago". */
export function daysLeftLabel(day: DayKey, today: DayKey): string {
  const n = daysBetween(today, day)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  return n > 0 ? `in ${n} days` : `${-n} days ago`
}
