import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { db, type PrayerLog, type PrayerName, type PrayerStatus } from '../../lib/db'
import { todayKey, type DayKey } from '../../lib/day'
import { useNow, useSelectedDay } from '../../lib/hooks'
import { APPS, openApp } from '../../lib/intents'
import {
  ADHKAR_EXTRAS, PRAYERS, SUNNAH_EXTRAS, fmtCountdown, fmtTime, missedPrayerDays, nextPrayer, prayerDayAt, prayerLabel,
  prayerStreak, qadaCount, qiblaBearing, timesFor, type PrayerConfig,
} from '../../lib/prayer'
import { setSetting, useSettings } from '../../lib/settings'
import { DayNav, FutureNotice } from '../../components/DayNav'
import {
  CalendarIcon, CheckIcon, CompassIcon, FlameIcon, LocationIcon, MinusIcon, MoonIcon, MosqueIcon, PlusIcon, QuranIcon,
  SunIcon, SunriseIcon, SunsetIcon,
} from '../../components/Icons'
import { MonthCalendar, monthRange } from '../../components/MonthCalendar'
import { Sheet, SheetAction } from '../../components/Sheet'
import { IconButton, TopBar } from '../../components/TopBar'
import { Button, Card, Chip, EmptyState, Field, Page, SectionLabel, TextInput } from '../../components/ui'
import { LocationSheet } from './LocationSheet'
import { QiblaSheet } from './Qibla'

const PRAYER_ICONS: Record<PrayerName, ReactNode> = {
  fajr: <SunriseIcon size={20} />,
  dhuhr: <SunIcon size={20} />,
  asr: <SunIcon size={20} />,
  maghrib: <SunsetIcon size={20} />,
  isha: <MoonIcon size={20} />,
}

const STATUS: { value: PrayerStatus; label: string; color: string }[] = [
  { value: 'ontime', label: 'On time', color: 'var(--success)' },
  { value: 'late', label: 'Late', color: 'var(--warning)' },
  { value: 'qada', label: 'Qada', color: 'var(--accent)' },
]

export function Prayer() {
  const settings = useSettings()
  const now = useNow(15_000)
  const [locOpen, setLocOpen] = useState(false)
  const [qibla, setQibla] = useState(false)
  const [overview, setOverview] = useState(false)
  const today = settings ? prayerDayAt(settings, now) : todayKey(now)
  const [day, setDay] = useSelectedDay(today)

  if (!settings) return null
  const cfg: PrayerConfig = settings

  return (
    <>
      <TopBar title="Prayer" actions={<>
        <IconButton label="Open Tarteel" onClick={() => openApp(APPS.tarteel)}><QuranIcon size={22} /></IconButton>
        {settings.prayerLocation && <IconButton label="Qibla" onClick={() => setQibla(true)}><CompassIcon size={22} /></IconButton>}
        <IconButton label="Overview" onClick={() => setOverview(true)}><CalendarIcon size={22} /></IconButton>
      </>} />
      {settings.prayerLocation ? (
        <PrayerBody cfg={cfg} today={today} day={day} setDay={setDay} now={now} qadaBase={settings.qadaBase} trackingStart={settings.prayerTrackingStart}
          onLocation={() => setLocOpen(true)} />
      ) : (
        <Page>
          <Card className="animate-rise-in">
            <EmptyState icon={<LocationIcon size={28} />} title="Set your location"
              action={<Button onClick={() => setLocOpen(true)}><LocationIcon size={20} /> Choose location</Button>}>
              Prayer times are calculated on your phone from your location, fully offline.
            </EmptyState>
          </Card>
        </Page>
      )}
      <LocationSheet open={locOpen} onClose={() => setLocOpen(false)} />
      {settings.prayerLocation && (
        <QiblaSheet open={qibla} onClose={() => setQibla(false)} bearing={qiblaBearing(cfg)!} place={settings.prayerLocation.name} />
      )}
      <PrayerOverview open={overview} onClose={() => setOverview(false)} today={today} trackingStart={settings.prayerTrackingStart}
        onPick={(d) => { setDay(d); setOverview(false) }} />
    </>
  )
}

function PrayerBody({ cfg, today, day, setDay, now, qadaBase, trackingStart, onLocation }: {
  cfg: PrayerConfig
  today: DayKey
  day: DayKey
  setDay: (d: DayKey) => void
  now: Date
  qadaBase: number
  trackingStart: DayKey | null
  onLocation: () => void
}) {
  const logs = useLiveQuery(() => db.prayerLogs.where('day').equals(day).toArray(), [day]) ?? []
  const extras = useLiveQuery(() => db.prayerExtras.get(day), [day])
  const allLogs = useLiveQuery(() => db.prayerLogs.toArray()) ?? []
  const times = timesFor(cfg, day)!
  const future = day > today
  const ended = day < today
  const byPrayer = new Map(logs.map((l) => [l.prayer, l]))
  const prayed = PRAYERS.filter((p) => byPrayer.get(p)?.status === 'ontime' || byPrayer.get(p)?.status === 'late').length
  const owed = qadaCount(qadaBase, trackingStart, allLogs, today)
  const streak = prayerStreak(allLogs, today)

  const setStatus = (p: PrayerName, status: PrayerStatus | null) => {
    const cur = byPrayer.get(p)
    db.prayerLogs.put({ id: `${day}|${p}`, day, prayer: p, status, jamaah: status ? cur?.jamaah ?? false : false })
  }
  const toggleJamaah = (p: PrayerName) => {
    const cur = byPrayer.get(p)
    const jamaah = !cur?.jamaah
    db.prayerLogs.put({ id: `${day}|${p}`, day, prayer: p, status: jamaah && !cur?.status ? 'ontime' : cur?.status ?? null, jamaah })
  }
  const toggleExtra = (key: string) => {
    db.prayerExtras.put({ day, done: { ...(extras?.done ?? {}), [key]: !extras?.done[key] } })
  }

  return (
    <Page>
      <Hero cfg={cfg} onLocation={onLocation} />
      <DayNav day={day} today={today} onChange={setDay} />
      {future && <FutureNotice />}

      <div className="stagger flex flex-col gap-3" key={day}>
        <Card className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {PRAYERS.map((p) => {
                const s = byPrayer.get(p)?.status
                const missed = !s && ended
                return <span key={p} className="h-2.5 w-2.5 rounded-full transition-colors"
                  style={{ background: s ? STATUS.find((x) => x.value === s)!.color : missed ? 'var(--danger)' : 'var(--surface-2)' }} />
              })}
            </div>
            <span className="text-[15px] font-semibold">{prayed} of 5 prayed</span>
          </div>
          {streak > 0 && <span className="flex items-center gap-1 text-[14px] font-semibold text-warning"><FlameIcon size={17} /> {streak} day{streak === 1 ? '' : 's'}</span>}
        </Card>

        {PRAYERS.map((p) => {
          const log = byPrayer.get(p)
          const at = times[p]
          const notYet = day === today && now < at
          const locked = future || notYet
          const missed = !log?.status && ended
          return (
            <PrayerRow key={p} label={prayerLabel(p, day)} icon={PRAYER_ICONS[p]} time={fmtTime(at)} log={log} locked={locked}
              notYet={notYet} missed={missed} onStatus={(s) => setStatus(p, s)} onJamaah={() => toggleJamaah(p)} />
          )
        })}

        <SectionLabel>Sunnah & Witr</SectionLabel>
        <Card>
          <div className="flex flex-wrap gap-2">
            {SUNNAH_EXTRAS.map((x) => (
              <Chip key={x.key} active={!!extras?.done[x.key]} onClick={() => !future && toggleExtra(x.key)}>
                {x.label}<span className="font-medium opacity-60">{x.detail}</span>
              </Chip>
            ))}
          </div>
        </Card>

        <SectionLabel>Adhkar</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {ADHKAR_EXTRAS.map((x, i) => {
            const on = !!extras?.done[x.key]
            return (
              <button key={x.key} type="button" disabled={future} onClick={() => toggleExtra(x.key)}
                className={`pressable flex min-h-[76px] flex-col justify-between rounded-[22px] p-4 text-left shadow-card transition-colors duration-200 disabled:opacity-50 ${on ? 'bg-accent text-white' : 'bg-surface'}`}>
                <span className="flex items-center justify-between">
                  {i === 0 ? <SunriseIcon size={22} /> : <MoonIcon size={22} />}
                  {on && <CheckIcon size={20} strokeWidth={3} className="animate-pop" />}
                </span>
                <span className="text-[15px] font-semibold">{x.label}</span>
              </button>
            )
          })}
        </div>

        <SectionLabel>Qada</SectionLabel>
        <QadaCard owed={owed} qadaBase={qadaBase} />
      </div>
    </Page>
  )
}

function Hero({ cfg, onLocation }: { cfg: PrayerConfig; onLocation: () => void }) {
  const now = useNow(1000)
  const next = nextPrayer(cfg, now)
  if (!next) return null
  return (
    <div className="animate-rise-in relative overflow-hidden rounded-[26px] p-5 text-white shadow-[0_12px_32px_-12px_var(--c-prayer)]"
      style={{ background: 'linear-gradient(135deg, #3b37b8 0%, #5b57e0 45%, #8b5cf6 100%)' }}>
      <div className="pointer-events-none absolute -top-10 -right-8 h-40 w-40 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-white/[0.06]" />
      <div className="relative">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white/70">Next prayer</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="text-[34px] leading-none font-bold tracking-tight">{prayerLabel(next.prayer, next.day)}</p>
          <p className="text-[26px] leading-none font-semibold tabular">{fmtTime(next.at)}</p>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="rounded-full bg-white/15 px-3 py-1.5 text-[15px] font-semibold tabular backdrop-blur">in {fmtCountdown(next.at.getTime() - now.getTime())}</span>
          <button type="button" onClick={onLocation} className="pressable flex items-center gap-1 text-[14px] font-medium text-white/80">
            <LocationIcon size={16} /> {cfg.prayerLocation?.name}
          </button>
        </div>
      </div>
    </div>
  )
}

function PrayerRow({ label, icon, time, log, locked, notYet, missed, onStatus, onJamaah }: {
  label: string
  icon: ReactNode
  time: string
  log: PrayerLog | undefined
  locked: boolean
  notYet: boolean
  missed: boolean
  onStatus: (s: PrayerStatus | null) => void
  onJamaah: () => void
}) {
  const status = log?.status ?? null
  const color = STATUS.find((s) => s.value === status)?.color
  return (
    <div className={`rounded-[22px] bg-surface p-3.5 shadow-card transition-shadow ${missed ? 'ring-2 ring-danger/40' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-colors duration-200"
          style={{ background: color ? `color-mix(in srgb, ${color} 16%, transparent)` : 'var(--surface-2)', color: color ?? 'var(--muted)' }}>
          {status ? <CheckIcon size={20} strokeWidth={2.8} className="animate-pop" /> : icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold">{label}</p>
          <p className={`text-[13px] tabular ${missed ? 'font-semibold text-danger' : 'text-muted'}`}>
            {time}{notYet ? ' · upcoming' : missed ? ' · missed' : ''}
          </p>
        </div>
        <button type="button" disabled={locked} onClick={onJamaah} aria-pressed={!!log?.jamaah} aria-label="Prayed in jama’ah"
          className={`pressable flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold transition-colors disabled:opacity-35 ${log?.jamaah ? 'bg-accent text-white' : 'bg-surface-2 text-muted'}`}>
          <MosqueIcon size={18} /> Jama’ah
        </button>
      </div>
      <div className={`mt-3 grid grid-cols-3 gap-1.5 ${locked ? 'opacity-40' : ''}`}>
        {STATUS.map((s) => {
          const active = status === s.value
          return (
            <button key={s.value} type="button" disabled={locked} onClick={() => onStatus(active ? null : s.value)} aria-pressed={active}
              className={`pressable min-h-10 rounded-[12px] text-[14px] font-semibold transition-colors duration-200 ${active ? 'text-white' : 'bg-surface-2 text-text'}`}
              style={active ? { background: s.color } : undefined}>
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function QadaCard({ owed, qadaBase }: { owed: number; qadaBase: number }) {
  const [edit, setEdit] = useState(false)
  const [value, setValue] = useState('')
  const auto = owed - qadaBase
  return (
    <Card>
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => { setValue(String(owed)); setEdit(true) }} className="pressable min-w-0 flex-1 text-left">
          <p className="text-[40px] leading-none font-bold tabular tracking-tight">{owed}</p>
          <p className="mt-1 text-[14px] text-muted">{owed === 1 ? 'prayer owed' : 'prayers owed'} · tap to set</p>
        </button>
        <div className="flex flex-col items-end gap-2">
          <button type="button" onClick={() => setSetting('qadaBase', qadaBase - 1)} disabled={owed <= 0}
            className="pressable flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-white disabled:opacity-35">
            <MinusIcon size={16} strokeWidth={2.6} /> Made one up
          </button>
          <button type="button" onClick={() => setSetting('qadaBase', qadaBase + 1)}
            className="pressable flex min-h-9 items-center gap-1 rounded-full bg-surface-2 px-3 text-[13px] font-semibold text-muted">
            <PlusIcon size={15} strokeWidth={2.6} /> Add one
          </button>
        </div>
      </div>
      <p className="mt-3 border-t border-line pt-3 text-[13px] leading-snug text-muted">
        Prayers left unlogged when their day ends are added automatically{auto > 0 ? ` (${auto} so far)` : ''}. Marking one as Qada takes it off again.
      </p>
      <Sheet open={edit} onClose={() => setEdit(false)} title="Prayers owed"
        action={<SheetAction disabled={!/^\d+$/.test(value)} onClick={() => { setSetting('qadaBase', qadaBase + (parseInt(value, 10) - owed)); setEdit(false) }}>Save</SheetAction>}>
        <Field label="Current number of owed prayers" hint="From here on the counter keeps itself up to date.">
          <TextInput inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} autoFocus className="text-[22px] font-semibold tabular" />
        </Field>
      </Sheet>
    </Card>
  )
}

function PrayerOverview({ open, onClose, today, trackingStart, onPick }: {
  open: boolean
  onClose: () => void
  today: DayKey
  trackingStart: DayKey | null
  onPick: (d: DayKey) => void
}) {
  const [range, setRange] = useState(() => monthRange(today))
  const logs = useLiveQuery(() => db.prayerLogs.toArray()) ?? []
  const missed = missedPrayerDays(logs, range.days, trackingStart, today)
  const streak = prayerStreak(logs, today)
  return (
    <Sheet open={open} onClose={onClose} title="Overview">
      <div className="mb-4 flex items-center justify-center gap-3 rounded-[20px] bg-warning-soft p-4">
        <FlameIcon size={30} className="text-warning" />
        <div>
          <p className="text-[24px] leading-none font-bold tabular">{streak} day{streak === 1 ? '' : 's'}</p>
          <p className="text-[13px] text-muted">All five prayed in a row</p>
        </div>
      </div>
      <MonthCalendar today={today} tone={(d) => (missed.has(d) ? 'missed' : null)}
        onPick={onPick}
        onMonthChange={(start) => setRange(monthRange(start))} />
      <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-muted">
        <span className="h-3 w-3 rounded-full bg-danger" /> A prayer was missed
      </div>
    </Sheet>
  )
}
