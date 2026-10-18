import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { backupOverdueDays } from '../lib/backup'
import { db } from '../lib/db'
import { longDate, weekdayName } from '../lib/day'
import { splitFor } from '../lib/fitness'
import { useNow } from '../lib/hooks'
import { summarizeDay } from '../lib/meds'
import { PRAYERS, fmtCountdown, fmtTime, nextPrayer, prayerDayAt, prayerLabel } from '../lib/prayer'
import { navigate } from '../lib/router'
import { useSettings, type Settings } from '../lib/settings'
import { compareTasks, isOverdue } from '../lib/todo'
import { useToday } from '../lib/useToday'
import { ArchiveIcon, CheckIcon, CheckListIcon, ChevronRight, DumbbellIcon, FlameIcon, GridIcon, LocationIcon, PillIcon } from '../components/Icons'
import { IconButton, TopBar } from '../components/TopBar'
import { Page, Ring } from '../components/ui'

function greeting(hour: number): string {
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

const go = (path: string) => () => navigate(path, { replace: true })

/** Read-only overview of the day. Fixed layout; tapping a card opens its tab. */
export function Home() {
  const today = useToday()
  const now = useNow(30_000)
  const settings = useSettings()
  const overdueBackup = useLiveQuery(() => backupOverdueDays(), [today])

  return (
    <>
      <TopBar eyebrow={`${weekdayName(today)}, ${longDate(today)}`} title={greeting(now.getHours())}
        actions={<IconButton label="More" tinted onClick={() => navigate('/more')}><GridIcon size={21} /></IconButton>} />
      <Page>
        <div className="stagger flex flex-col gap-3">
          {overdueBackup != null && (
            <button type="button" onClick={() => navigate('/more/backup')}
              className="pressable flex items-center gap-3 rounded-[22px] bg-warning-soft p-4 text-left">
              <ArchiveIcon size={22} className="shrink-0 text-warning" />
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">Time for a backup</span>
                <span className="block text-[13px] text-muted">Last one was {overdueBackup} days ago. Tap to export.</span>
              </span>
              <ChevronRight size={18} className="text-muted" />
            </button>
          )}
          {settings && <PrayerCard settings={settings} />}
          <MedsCard today={today} />
          <TodoCard today={today} />
          {settings && (
            <div className="grid grid-cols-2 gap-3">
              <TrainingCard settings={settings} today={today} />
              <NutritionCard settings={settings} today={today} />
            </div>
          )}
        </div>
      </Page>
    </>
  )
}

function Tile({ sec, onClick, children, className = '' }: { sec: string; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" data-sec={sec} onClick={onClick}
      className={`pressable block w-full rounded-[24px] bg-surface p-4 text-left shadow-card ${className}`}>{children}</button>
  )
}

function TileHeader({ icon, title, right }: { icon: ReactNode; title: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-accent-soft text-accent">{icon}</span>
      <span className="flex-1 text-[14px] font-semibold text-accent">{title}</span>
      {right ?? <ChevronRight size={17} className="text-faint" />}
    </div>
  )
}

function PrayerCard({ settings }: { settings: Settings }) {
  const now = useNow(1000)
  const day = prayerDayAt(settings, now)
  const logs = useLiveQuery(() => db.prayerLogs.where('day').equals(day).toArray(), [day]) ?? []
  const next = nextPrayer(settings, now)
  const byPrayer = new Map(logs.map((l) => [l.prayer, l.status]))

  return (
    <button type="button" data-sec="prayer" onClick={go('/prayer')}
      className="pressable relative block w-full overflow-hidden rounded-[26px] p-5 text-left text-white shadow-[0_12px_32px_-14px_var(--c-prayer)]"
      style={{ background: 'linear-gradient(135deg, #3b37b8 0%, #5b57e0 45%, #8b5cf6 100%)' }}>
      <div className="pointer-events-none absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/10" />
      {!settings.prayerLocation || !next ? (
        <div className="relative flex items-center gap-3">
          <LocationIcon size={26} />
          <div>
            <p className="text-[18px] font-semibold">Prayer times</p>
            <p className="text-[14px] text-white/80">Set your location to see today’s times.</p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">Next · {fmtTime(next.at)}</p>
              <p className="text-[30px] leading-tight font-bold tracking-tight">{prayerLabel(next.prayer, next.day)}</p>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1.5 text-[15px] font-semibold tabular">{fmtCountdown(next.at.getTime() - now.getTime())}</span>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {PRAYERS.map((p) => {
              const s = byPrayer.get(p)
              return (
                <div key={p} className="flex flex-col items-center gap-1.5">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${s === 'ontime' ? 'bg-white text-[#3b37b8]' : s === 'late' ? 'bg-amber-300 text-[#3b2a00]' : s === 'qada' ? 'bg-white/45 text-white' : 'bg-white/15'}`}>
                    {s && <CheckIcon size={16} strokeWidth={3.2} />}
                  </span>
                  <span className="text-[11px] font-semibold text-white/80">{prayerLabel(p, day)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </button>
  )
}

function MedsCard({ today }: { today: string }) {
  const meds = useLiveQuery(() => db.meds.toArray()) ?? []
  const logs = useLiveQuery(() => db.medLogs.where('day').equals(today).toArray(), [today]) ?? []
  const sum = summarizeDay(meds, logs, today)
  const done = sum.due > 0 && sum.taken === sum.due
  return (
    <Tile sec="meds" onClick={go('/meds')}>
      <TileHeader icon={<PillIcon size={16} />} title="Medications" />
      {sum.due === 0 ? (
        <p className="text-[15px] text-muted">No scheduled doses today.</p>
      ) : (
        <div className="flex items-center gap-4">
          <Ring value={sum.taken} max={sum.due} size={58} stroke={7}>
            {done ? <CheckIcon size={22} strokeWidth={3} className="text-accent" /> : <span className="text-[14px] font-bold tabular">{sum.taken}/{sum.due}</span>}
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-semibold">{sum.taken} of {sum.due} doses taken</p>
            <p className="truncate text-[14px] text-muted">
              {done ? 'All done for today' : sum.remaining.map((r) => (r.slots.length > 1 ? `${r.name} ×${r.slots.length}` : r.name)).join(' · ')}
            </p>
          </div>
        </div>
      )}
    </Tile>
  )
}

function TodoCard({ today }: { today: string }) {
  const lists = useLiveQuery(() => db.todoLists.filter((l) => !l.archived).toArray()) ?? []
  const tasks = useLiveQuery(() => db.tasks.filter((t) => !t.done && !!t.due && t.due <= today).toArray(), [today]) ?? []
  const byList = new Map(lists.map((l) => [l.id, l]))
  const live = tasks.filter((t) => byList.has(t.listId)).sort(compareTasks)
  const overdue = live.filter((t) => isOverdue(t, today)).length
  const dueToday = live.filter((t) => t.due === today).length
  return (
    <Tile sec="todo" onClick={go('/todo')}>
      <TileHeader icon={<CheckListIcon size={16} />} title="To-dos" />
      <div className="flex gap-6">
        <div>
          <p className="text-[30px] leading-none font-bold tabular">{dueToday}</p>
          <p className="mt-1 text-[13px] text-muted">due today</p>
        </div>
        <div>
          <p className={`text-[30px] leading-none font-bold tabular ${overdue ? 'text-danger' : ''}`}>{overdue}</p>
          <p className="mt-1 text-[13px] text-muted">overdue</p>
        </div>
      </div>
      {live.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
          {live.slice(0, 3).map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 text-[15px]">
              <span className="h-[18px] w-[18px] shrink-0 rounded-full border-2" style={{ borderColor: isOverdue(t, today) ? 'var(--danger)' : byList.get(t.listId)?.color }} />
              <span className={`truncate ${isOverdue(t, today) ? 'text-danger' : ''}`}>{t.title}</span>
            </li>
          ))}
          {live.length > 3 && <li className="pl-7 text-[13px] text-muted">+{live.length - 3} more</li>}
        </ul>
      )}
      {live.length === 0 && <p className="mt-2 text-[14px] text-muted">Nothing due. Nice.</p>}
    </Tile>
  )
}

function TrainingCard({ settings, today }: { settings: Settings; today: string }) {
  const splits = useLiveQuery(() => db.splitDays.toArray()) ?? []
  const log = useLiveQuery(() => db.trainingDays.get(today), [today])
  const split = splitFor(settings, splits, today, log)
  return (
    <Tile sec="fitness" onClick={go('/fitness')} className="flex min-h-[148px] flex-col">
      <TileHeader icon={<DumbbellIcon size={16} />} title="Training" right={<span />} />
      <p className="truncate text-[22px] leading-tight font-bold">{split?.name ?? (splits.length ? 'Nothing planned' : 'Set up split')}</p>
      <div className="mt-auto pt-3">
        {log?.trained ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[13px] font-semibold text-success"><CheckIcon size={14} strokeWidth={3} /> Trained</span>
        ) : split?.rest ? (
          <span className="text-[13px] font-medium text-muted">Rest day</span>
        ) : (
          <span className="inline-flex rounded-full bg-surface-2 px-2.5 py-1 text-[13px] font-semibold text-muted">Not yet</span>
        )}
      </div>
    </Tile>
  )
}

function NutritionCard({ settings, today }: { settings: Settings; today: string }) {
  const entries = useLiveQuery(() => db.nutrition.where('day').equals(today).toArray(), [today]) ?? []
  const kcal = entries.filter((e) => e.kind === 'kcal').reduce((n, e) => n + e.amount, 0)
  const protein = entries.filter((e) => e.kind === 'protein').reduce((n, e) => n + e.amount, 0)
  return (
    <Tile sec="fitness" onClick={go('/fitness')} className="flex min-h-[148px] flex-col">
      <TileHeader icon={<FlameIcon size={16} />} title="Nutrition" right={<span />} />
      <div className="mt-auto flex items-center justify-around">
        <div className="flex flex-col items-center gap-1">
          <Ring value={kcal} max={settings.kcalTarget} size={54} stroke={6} color="var(--c-kcal)">
            <span className="text-[12px] font-bold tabular">{kcal >= 1000 ? `${(kcal / 1000).toFixed(1)}k` : kcal}</span>
          </Ring>
          <span className="text-[11px] font-semibold text-muted">kcal</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <Ring value={protein} max={settings.proteinTarget} size={54} stroke={6} color="var(--c-protein)">
            <span className="text-[12px] font-bold tabular">{protein}g</span>
          </Ring>
          <span className="text-[11px] font-semibold text-muted">protein</span>
        </div>
      </div>
    </Tile>
  )
}
