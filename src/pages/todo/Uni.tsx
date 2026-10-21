import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db, uid, type Exam, type Lecture, type TodoList } from '../../lib/db'
import { daysBetween, longDate, parseKey, type DayKey } from '../../lib/day'
import { useNow } from '../../lib/hooks'
import { setSetting, useSettings } from '../../lib/settings'
import { LIST_COLORS } from '../../lib/todo'
import { COURSE_COLORS, LECTURE_TYPES, byStart, courseColor, daysLeftLabel, inSemester, lecturesOn, upcomingExams } from '../../lib/uni'
import { CalendarIcon, ChevronDown, GraduationIcon, MapPinSmallIcon, PencilIcon, PlusIcon, TrashIcon } from '../../components/Icons'
import { ConfirmSheet, Sheet, SheetAction } from '../../components/Sheet'
import { Button, Card, Chip, EmptyState, Field, SectionLabel, Segmented, TextInput, inputCls } from '../../components/ui'

const WEEK = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const typeLabel = (t: Lecture['type']) => LECTURE_TYPES.find((x) => x.value === t)!.label

export function UniView({ today, lists, onOpenList }: { today: DayKey; lists: TodoList[]; onOpenList: (list: TodoList, rect: DOMRect) => void }) {
  const settings = useSettings()
  const lectures = useLiveQuery(() => db.lectures.toArray()) ?? []
  const exams = useLiveQuery(() => db.exams.toArray()) ?? []
  const openTasks = useLiveQuery(() => db.tasks.filter((t) => !t.done).toArray()) ?? []
  const [mode, setMode] = useState<'today' | 'week'>('today')
  const [editLecture, setEditLecture] = useState<Lecture | 'new' | null>(null)
  const [editExam, setEditExam] = useState<Exam | 'new' | null>(null)
  const [semester, setSemester] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const now = useNow(60_000)
  if (!settings) return null

  const { semesterStart: start, semesterEnd: end } = settings
  const active = inSemester(today, start, end)
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const upcoming = upcomingExams(exams, today)
  const past = exams.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date))
  const courses = [...new Set([...lectures.map((l) => l.course), ...exams.map((e) => e.course)])].sort()

  const semesterLine = start && end ? `${longDate(start)} – ${longDate(end)}` : 'Not set'
  const status = !start || !end ? null : today < start ? `Starts ${daysLeftLabel(start, today)}` : today > end ? 'Semester has ended' : `Week ${Math.floor(daysBetween(start, today) / 7) + 1}`

  return (
    <>
      <button type="button" onClick={() => setSemester(true)} className="pressable flex items-center gap-3 rounded-[22px] bg-surface p-4 text-left shadow-card">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent"><GraduationIcon size={22} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">Semester</span>
          <span className="block truncate text-[15px] font-semibold">{semesterLine}</span>
        </span>
        {status && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-semibold text-accent">{status}</span>}
        <PencilIcon size={17} className="text-faint" />
      </button>

      <SectionLabel action={<button type="button" onClick={() => setEditLecture('new')} aria-label="Add lecture" className="pressable flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent"><PlusIcon size={18} strokeWidth={2.5} /></button>}>
        Timetable
      </SectionLabel>
      {!start || !end ? (
        <Card><EmptyState icon={<CalendarIcon size={26} />} title="Set your semester"
          action={<Button small onClick={() => setSemester(true)}>Set dates</Button>}>The timetable shows during the semester only.</EmptyState></Card>
      ) : !active ? (
        <Card><p className="py-3 text-center text-[15px] text-muted">{today < start ? `Lectures start ${longDate(start)}.` : `The semester ended ${longDate(end)}.`} {lectures.length} lecture{lectures.length === 1 ? '' : 's'} saved.</p></Card>
      ) : (
        <>
          <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'today', label: 'Today' }, { value: 'week', label: 'Full week' }]} />
          {mode === 'today' ? (
            <LectureList items={lecturesOn(lectures, today)} time={time} onEdit={setEditLecture}
              empty={lectures.length ? 'No lectures today.' : 'Add your lectures with the + button.'} />
          ) : (
            WEEK.filter((wd) => lectures.some((l) => l.weekday === wd)).map((wd) => (
              <div key={wd} className="flex flex-col gap-2">
                <p className="px-1 text-[14px] font-semibold">{WEEKDAY_NAMES[wd]}</p>
                <LectureList items={lectures.filter((l) => l.weekday === wd).sort(byStart)} onEdit={setEditLecture} empty="" />
              </div>
            ))
          )}
          {mode === 'week' && lectures.length === 0 && <Card><p className="py-3 text-center text-[15px] text-muted">No lectures yet.</p></Card>}
        </>
      )}

      <SectionLabel action={<button type="button" onClick={() => setEditExam('new')} aria-label="Add exam or deadline" className="pressable flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent"><PlusIcon size={18} strokeWidth={2.5} /></button>}>
        Exams & deadlines
      </SectionLabel>
      <div className="flex flex-col gap-2">
        {upcoming.map((e) => <ExamRow key={e.id} exam={e} today={today} list={lists.find((l) => l.id === e.listId)}
          prep={openTasks.filter((t) => t.listId === e.listId).length} onEdit={() => setEditExam(e)} onOpenList={onOpenList} />)}
        {upcoming.length === 0 && <Card><p className="py-3 text-center text-[15px] text-muted">Nothing coming up. Add exams and submissions with +.</p></Card>}
        {past.length > 0 && (
          <button type="button" onClick={() => setShowPast(!showPast)} className="flex items-center justify-center gap-1 py-2 text-[14px] font-semibold text-muted">
            {past.length} past <ChevronDown size={16} className={`transition-transform ${showPast ? 'rotate-180' : ''}`} />
          </button>
        )}
        {showPast && past.map((e) => <ExamRow key={e.id} exam={e} today={today} list={lists.find((l) => l.id === e.listId)} prep={0} past
          onEdit={() => setEditExam(e)} onOpenList={onOpenList} />)}
      </div>

      <LectureSheet open={editLecture !== null} lecture={editLecture === 'new' ? null : editLecture} courses={courses} onClose={() => setEditLecture(null)} />
      <ExamSheet open={editExam !== null} exam={editExam === 'new' ? null : editExam} courses={courses} lists={lists} today={today} onClose={() => setEditExam(null)} />
      <SemesterSheet open={semester} start={start} end={end} today={today} onClose={() => setSemester(false)} />
    </>
  )
}

function LectureList({ items, time, onEdit, empty }: { items: Lecture[]; time?: string; onEdit: (l: Lecture) => void; empty: string }) {
  if (!items.length) return empty ? <Card><p className="py-3 text-center text-[15px] text-muted">{empty}</p></Card> : null
  return (
    <div className="rounded-[22px] bg-surface px-2 py-1 shadow-card">
      {items.map((l) => {
        const now = time !== undefined && l.start <= time && l.end > time
        const over = time !== undefined && l.end <= time
        const color = courseColor(l.course, l.color)
        return (
          <button key={l.id} type="button" onClick={() => onEdit(l)}
            className={`flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-2 py-2 text-left active:bg-surface-2 ${over ? 'opacity-45' : ''}`}>
            <span className="w-12 shrink-0 text-right tabular">
              <span className="block text-[15px] font-semibold">{l.start}</span>
              <span className="block text-[12px] text-muted">{l.end}</span>
            </span>
            <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: color }} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[16px] font-semibold">{l.course}</span>
                {now && <span className="animate-pulse-dot rounded-full bg-success px-2 py-0.5 text-[11px] font-bold text-white">NOW</span>}
              </span>
              <span className="flex items-center gap-1 text-[13px] text-muted">
                {typeLabel(l.type)}{l.room && <><span>·</span><MapPinSmallIcon size={13} />{l.room}</>}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

function ExamRow({ exam, today, list, prep, past, onEdit, onOpenList }: {
  exam: Exam
  today: DayKey
  list: TodoList | undefined
  prep: number
  past?: boolean
  onEdit: () => void
  onOpenList: (list: TodoList, rect: DOMRect) => void
}) {
  const left = daysBetween(today, exam.date)
  const urgent = !past && left <= 3
  const soon = !past && left <= 7
  const d = parseKey(exam.date)
  return (
    <div className={`rounded-[22px] bg-surface p-3 shadow-card ${past ? 'opacity-55' : ''}`}>
      <button type="button" onClick={onEdit} className="flex w-full items-center gap-3 text-left">
        <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[14px]"
          style={{ background: `color-mix(in srgb, ${courseColor(exam.course)} 16%, transparent)`, color: courseColor(exam.course) }}>
          <span className="text-[17px] leading-none font-bold tabular">{d.getDate()}</span>
          <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString('en-GB', { month: 'short' })}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold">{exam.course}</span>
          <span className="block truncate text-[13px] text-muted">
            {exam.type === 'exam' ? 'Exam' : 'Submission'} · {WEEKDAY_SHORT[d.getDay()]}{exam.time ? ` ${exam.time}` : ''}{exam.room ? ` · ${exam.room}` : ''}
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold tabular ${urgent ? 'bg-danger text-white' : soon ? 'bg-warning-soft text-warning' : 'bg-surface-2 text-muted'}`}>
          {daysLeftLabel(exam.date, today)}
        </span>
      </button>
      {list && (
        <button type="button" onClick={(e) => onOpenList(list, (e.currentTarget as HTMLElement).getBoundingClientRect())}
          className="pressable mt-2 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left"
          style={{ background: `color-mix(in srgb, ${list.color} 12%, transparent)` }}>
          <span className="text-[16px]">{list.icon}</span>
          <span className="flex-1 truncate text-[14px] font-semibold">{list.name}</span>
          <span className="text-[13px] font-semibold" style={{ color: list.color }}>{prep ? `${prep} prep task${prep === 1 ? '' : 's'}` : 'No open tasks'}</span>
        </button>
      )}
    </div>
  )
}

function LectureSheet({ open, lecture, courses, onClose }: { open: boolean; lecture: Lecture | null; courses: string[]; onClose: () => void }) {
  const [course, setCourse] = useState('')
  const [type, setType] = useState<Lecture['type']>('lecture')
  const [weekday, setWeekday] = useState(1)
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('12:00')
  const [room, setRoom] = useState('')
  const [color, setColor] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    setCourse(lecture?.course ?? '')
    setType(lecture?.type ?? 'lecture')
    setWeekday(lecture?.weekday ?? 1)
    setStart(lecture?.start ?? '10:00')
    setEnd(lecture?.end ?? '12:00')
    setRoom(lecture?.room ?? '')
    setColor(lecture?.color ?? null)
  }, [open, lecture])

  const valid = course.trim() && start && end && end > start
  const save = async () => {
    if (!valid) return
    const fields = { course: course.trim(), type, weekday, start, end, room: room.trim(), color }
    if (lecture) await db.lectures.update(lecture.id, fields)
    else await db.lectures.add({ ...fields, id: uid() })
    onClose()
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={lecture ? 'Edit lecture' : 'New lecture'} action={<SheetAction onClick={save} disabled={!valid}>{lecture ? 'Save' : 'Add'}</SheetAction>}>
        <div className="flex flex-col gap-5">
          <Field label="Course">
            <TextInput value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. Linear Algebra" autoFocus={!lecture} />
            {courses.length > 0 && !lecture && (
              <div className="no-scrollbar -mx-5 mt-1 flex gap-2 overflow-x-auto px-5">
                {courses.map((c) => <Chip key={c} active={c === course} color={courseColor(c)} onClick={() => setCourse(c)}>{c}</Chip>)}
              </div>
            )}
          </Field>
          <Field label="Type">
            <Segmented value={type} onChange={setType} options={LECTURE_TYPES} />
          </Field>
          <Field label="Day">
            <div className="grid grid-cols-7 gap-1">
              {WEEK.map((wd) => (
                <button key={wd} type="button" aria-pressed={wd === weekday} onClick={() => setWeekday(wd)}
                  className={`pressable h-11 rounded-xl text-[13px] font-semibold ${wd === weekday ? 'bg-accent text-white' : 'bg-surface-2 text-muted'}`}>{WEEKDAY_SHORT[wd]}</button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts"><input type="time" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Ends"><input type="time" className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
          </div>
          {start && end && end <= start && <p className="-mt-3 px-1 text-[13px] text-danger">The end time must be after the start.</p>}
          <Field label="Room"><TextInput value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. H 0104" /></Field>
          <Field label="Color (optional)">
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setColor(null)} aria-pressed={color === null}
                className={`pressable flex h-10 items-center rounded-full px-3 text-[13px] font-semibold ${color === null ? 'bg-text text-bg' : 'bg-surface-2 text-muted'}`}>Auto</button>
              {COURSE_COLORS.map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => setColor(c)}
                  className={`pressable h-10 w-10 rounded-full ${c === color ? 'ring-[3px] ring-offset-2 ring-offset-surface' : ''}`}
                  style={{ background: c, ['--tw-ring-color' as string]: c }} />
              ))}
            </div>
          </Field>
          {lecture && (
            <button type="button" onClick={() => setConfirm(true)} className="pressable flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-danger-soft text-[16px] font-semibold text-danger">
              <TrashIcon size={20} /> Delete lecture
            </button>
          )}
        </div>
      </Sheet>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title="Delete this lecture?" message={lecture ? `${lecture.course} · ${WEEKDAY_NAMES[lecture.weekday]} ${lecture.start}` : ''}
        confirmLabel="Delete" onConfirm={async () => { if (lecture) await db.lectures.delete(lecture.id); onClose() }} />
    </>
  )
}

function ExamSheet({ open, exam, courses, lists, today, onClose }: { open: boolean; exam: Exam | null; courses: string[]; lists: TodoList[]; today: DayKey; onClose: () => void }) {
  const [course, setCourse] = useState('')
  const [type, setType] = useState<Exam['type']>('exam')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState<string | null>(null)
  const [room, setRoom] = useState('')
  const [listId, setListId] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    setCourse(exam?.course ?? '')
    setType(exam?.type ?? 'exam')
    setDate(exam?.date ?? today)
    setTime(exam?.time ?? null)
    setRoom(exam?.room ?? '')
    setListId(exam?.listId ?? null)
  }, [open, exam, today])

  const valid = course.trim() && date
  const save = async () => {
    if (!valid) return
    const fields = { course: course.trim(), type, date, time, room: room.trim(), listId }
    if (exam) await db.exams.update(exam.id, fields)
    else await db.exams.add({ ...fields, id: uid() })
    onClose()
  }

  /** Creates a prep list named after the exam and links it. */
  const newList = async () => {
    const id = uid()
    const name = `${course.trim() || 'Exam'} ${type === 'exam' ? 'prep' : 'submission'}`
    await db.todoLists.add({ id, name, color: LIST_COLORS[lists.length % LIST_COLORS.length], icon: '🎓', order: Date.now(), archived: false })
    setListId(id)
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title={exam ? 'Edit' : 'New exam or deadline'} action={<SheetAction onClick={save} disabled={!valid}>{exam ? 'Save' : 'Add'}</SheetAction>}>
        <div className="flex flex-col gap-5">
          <Field label="Course">
            <TextInput value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. Linear Algebra" autoFocus={!exam} />
            {courses.length > 0 && !exam && (
              <div className="no-scrollbar -mx-5 mt-1 flex gap-2 overflow-x-auto px-5">
                {courses.map((c) => <Chip key={c} active={c === course} color={courseColor(c)} onClick={() => setCourse(c)}>{c}</Chip>)}
              </div>
            )}
          </Field>
          <Field label="Type">
            <Segmented value={type} onChange={setType} options={[{ value: 'exam', label: 'Exam' }, { value: 'submission', label: 'Submission' }]} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><input type="date" className={inputCls} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} /></Field>
            <Field label="Time (optional)"><input type="time" className={inputCls} value={time ?? ''} onChange={(e) => setTime(e.target.value || null)} /></Field>
          </div>
          <Field label="Room (optional)"><TextInput value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Audimax" /></Field>
          <Field label="Prep tasks list">
            <div className="flex flex-wrap gap-2">
              <Chip active={listId === null} onClick={() => setListId(null)}>None</Chip>
              {lists.map((l) => <Chip key={l.id} active={l.id === listId} color={l.color} onClick={() => setListId(l.id)}><span>{l.icon}</span>{l.name}</Chip>)}
              <button type="button" onClick={newList} className="pressable flex min-h-10 items-center gap-1 rounded-full bg-accent-soft px-3.5 text-[14px] font-semibold text-accent">
                <PlusIcon size={16} /> New list
              </button>
            </div>
          </Field>
          {exam && (
            <button type="button" onClick={() => setConfirm(true)} className="pressable flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-danger-soft text-[16px] font-semibold text-danger">
              <TrashIcon size={20} /> Delete
            </button>
          )}
        </div>
      </Sheet>
      <ConfirmSheet open={confirm} onClose={() => setConfirm(false)} title="Delete this?" message={exam ? `${exam.course} · ${longDate(exam.date)}. Its prep list stays.` : ''}
        confirmLabel="Delete" onConfirm={async () => { if (exam) await db.exams.delete(exam.id); onClose() }} />
    </>
  )
}

function SemesterSheet({ open, start, end, today, onClose }: { open: boolean; start: DayKey | null; end: DayKey | null; today: DayKey; onClose: () => void }) {
  const [s, setS] = useState(start ?? today)
  const [e, setE] = useState(end ?? today)
  useEffect(() => {
    if (open) { setS(start ?? today); setE(end ?? today) }
  }, [open, start, end, today])
  const valid = s && e && e >= s
  return (
    <Sheet open={open} onClose={onClose} title="Semester" action={<SheetAction disabled={!valid} onClick={async () => {
      await setSetting('semesterStart', s)
      await setSetting('semesterEnd', e)
      onClose()
    }}>Save</SheetAction>}>
      <div className="flex flex-col gap-4">
        <Field label="Lectures start"><input type="date" className={inputCls} value={s} onChange={(ev) => ev.target.value && setS(ev.target.value)} /></Field>
        <Field label="Lectures end"><input type="date" className={inputCls} min={s} value={e} onChange={(ev) => ev.target.value && setE(ev.target.value)} /></Field>
        <p className="px-1 text-[13px] text-muted">Outside these dates the timetable is hidden. Exams and deadlines always show.</p>
      </div>
    </Sheet>
  )
}
