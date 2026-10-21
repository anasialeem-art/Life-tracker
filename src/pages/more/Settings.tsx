import { useEffect, useState } from 'react'
import { formatHijri, hijriOf } from '../../lib/hijri'
import { HIGH_LAT_RULES, METHODS } from '../../lib/prayer'
import { META, loadQuran } from '../../lib/quran'
import { navigate } from '../../lib/router'
import { setSetting, useSettings, type Settings as SettingsShape } from '../../lib/settings'
import { isStandalone, useOnline, usePersisted } from '../../lib/storage'
import { useToday } from '../../lib/useToday'
import {
  ArchiveIcon, CheckIcon, CheckListIcon, ChevronRight, CompassIcon, DumbbellIcon, FlameIcon, GraduationIcon, HabitIcon, LocationIcon, MoonIcon,
  QuranIcon, SunIcon, TrophyIcon, WalletIcon,
} from '../../components/Icons'
import { Sheet } from '../../components/Sheet'
import { TopBar } from '../../components/TopBar'
import { Group, Page, Row, SectionLabel, Segmented, Stepper } from '../../components/ui'
import { SplitEditor } from '../fitness/SplitEditor'
import { LocationSheet } from '../prayer/LocationSheet'
import { ListsSheet } from '../todo/ListsSheet'
import { CategoriesSheet } from './Money'

const CURRENCIES = ['€', '$', '£', 'CHF', 'PKR', 'Rs', 'AED', 'SAR', 'TRY']

function Picker<T extends string>({ open, onClose, title, options, value, onPick }: {
  open: boolean
  onClose: () => void
  title: string
  options: { key: T; label: string }[]
  value: T
  onPick: (v: T) => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-1.5">
        {options.map((o) => (
          <button key={o.key} type="button" onClick={() => { onPick(o.key); onClose() }}
            className={`pressable flex min-h-[52px] items-center justify-between rounded-2xl px-4 text-left text-[16px] ${o.key === value ? 'bg-accent-soft font-semibold text-accent' : 'bg-surface-2'}`}>
            {o.label}
            {o.key === value && <CheckIcon size={20} strokeWidth={2.8} />}
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/** Inline number field that saves on blur/enter. */
function NumberRow({ icon, label, unit, value, onSave }: { icon: React.ReactNode; label: string; unit: string; value: number; onSave: (n: number) => void }) {
  const [text, setText] = useState(String(value))
  useEffect(() => setText(String(value)), [value])
  const commit = () => {
    const n = parseInt(text, 10)
    if (n > 0 && n !== value) onSave(n)
    else setText(String(value))
  }
  return (
    <Row icon={icon} label={label}>
      <span className="flex items-center gap-1.5">
        <input value={text} inputMode="numeric" onChange={(e) => setText(e.target.value.replace(/\D/g, ''))} onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label={label}
          className="h-10 w-20 rounded-xl bg-surface-2 text-center text-[16px] font-semibold outline-none tabular focus:ring-2 focus:ring-accent/40" />
        <span className="w-8 text-[14px] text-muted">{unit}</span>
      </span>
    </Row>
  )
}

export function Settings() {
  const s = useSettings()
  const today = useToday()
  const persisted = usePersisted()
  const online = useOnline()
  const offlineReady = !!navigator.serviceWorker?.controller
  const [open, setOpen] = useState<null | 'location' | 'method' | 'highlat' | 'split' | 'lists' | 'categories'>(null)
  const close = () => setOpen(null)
  if (!s) return <TopBar title="Settings" backTo="/more" />

  return (
    <>
      <TopBar title="Settings" backTo="/more" />
      <Page>
        <SectionLabel>Appearance</SectionLabel>
        <Group className="p-3">
          <Segmented<SettingsShape['theme']> value={s.theme} onChange={(v) => setSetting('theme', v)} options={[
            { value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' },
          ]} />
        </Group>

        <SectionLabel>Prayer</SectionLabel>
        <Group>
          <Row icon={<LocationIcon size={18} />} label="Location" detail={s.prayerLocation?.name ?? 'Not set'} onClick={() => setOpen('location')}><ChevronRight size={18} className="text-faint" /></Row>
          <Row icon={<CompassIcon size={18} />} label="Calculation" detail={METHODS.find((m) => m.key === s.prayerMethod)?.label} onClick={() => setOpen('method')}><ChevronRight size={18} className="text-faint" /></Row>
          <Row icon={<SunIcon size={18} />} label="Asr">
            <div className="w-40"><Segmented size="sm" value={s.asrMethod} onChange={(v) => setSetting('asrMethod', v)} options={[{ value: 'shafi', label: 'Shafi‘i' }, { value: 'hanafi', label: 'Hanafi' }]} /></div>
          </Row>
          <Row icon={<MoonIcon size={18} />} label="High latitude" detail={HIGH_LAT_RULES.find((r) => r.key === s.highLatRule)?.label} onClick={() => setOpen('highlat')}><ChevronRight size={18} className="text-faint" /></Row>
        </Group>
        <p className="px-4 text-[12px] leading-snug text-muted">The high-latitude rule matters in German summers, when the sky never gets fully dark and Fajr/Isha need an approximation.</p>

        <SectionLabel>Quran & fasting</SectionLabel>
        <Group>
          <Row icon={<QuranIcon size={18} />} label="Mushaf">
            <div className="w-44"><Segmented size="sm" value={s.quranStyle} onChange={(v) => setSetting('quranStyle', v)} options={[{ value: 'tajweed', label: 'Tajweed' }, { value: 'text', label: 'Plain text' }]} /></div>
          </Row>
          <NumberRow icon={<QuranIcon size={18} />} label="Daily page goal" unit="pages" value={s.quranDailyGoal} onSave={(n) => setSetting('quranDailyGoal', n)} />
          <Row icon={<TrophyIcon size={18} />} label="Completed khatmas">
            <Stepper value={s.quranKhatmasCompleted} min={0} max={999} onChange={(n) => setSetting('quranKhatmasCompleted', n)} />
          </Row>
          <Row icon={<MoonIcon size={18} />} label="Hijri date adjustment" />
          <div className="px-3 pb-3">
            <Segmented size="sm" value={String(s.hijriOffset)} onChange={(v) => setSetting('hijriOffset', parseInt(v, 10))}
              options={['-2', '-1', '0', '1', '2'].map((v) => ({ value: v, label: v === '0' ? '0' : `${v.startsWith('-') ? '−' + v.slice(1) : '+' + v}` }))} />
            <p className="px-1 pt-2 text-[12px] leading-snug text-muted">Today is {formatHijri(hijriOf(today, s.hijriOffset))}. Shift by a day or two to match your local moon sighting.</p>
          </div>
        </Group>

        <SectionLabel>Uni</SectionLabel>
        <Group>
          <Row icon={<GraduationIcon size={18} />} label="Semester starts">
            <input type="date" value={s.semesterStart ?? ''} onChange={(e) => setSetting('semesterStart', e.target.value || null)} aria-label="Semester start"
              className="h-10 rounded-xl bg-surface-2 px-2 text-[15px] outline-none" />
          </Row>
          <Row icon={<GraduationIcon size={18} />} label="Semester ends">
            <input type="date" value={s.semesterEnd ?? ''} min={s.semesterStart ?? undefined} onChange={(e) => setSetting('semesterEnd', e.target.value || null)} aria-label="Semester end"
              className="h-10 rounded-xl bg-surface-2 px-2 text-[15px] outline-none" />
          </Row>
        </Group>

        <SectionLabel>Fitness</SectionLabel>
        <Group>
          <NumberRow icon={<FlameIcon size={18} />} label="Calorie target" unit="kcal" value={s.kcalTarget} onSave={(n) => setSetting('kcalTarget', n)} />
          <NumberRow icon={<DumbbellIcon size={18} />} label="Protein target" unit="g" value={s.proteinTarget} onSave={(n) => setSetting('proteinTarget', n)} />
          <Row icon={<DumbbellIcon size={18} />} label="Split & mode" detail={s.splitMode === 'weekday' ? 'Weekdays' : 'Cycle'} onClick={() => setOpen('split')}><ChevronRight size={18} className="text-faint" /></Row>
        </Group>

        <SectionLabel>Lists & categories</SectionLabel>
        <Group>
          <Row icon={<CheckListIcon size={18} />} label="To-do lists" onClick={() => setOpen('lists')}><ChevronRight size={18} className="text-faint" /></Row>
          <Row icon={<HabitIcon size={18} />} label="Habits" onClick={() => navigate('/more/habits')}><ChevronRight size={18} className="text-faint" /></Row>
          <Row icon={<WalletIcon size={18} />} label="Money categories" onClick={() => setOpen('categories')}><ChevronRight size={18} className="text-faint" /></Row>
          <Row icon={<WalletIcon size={18} />} label="Currency">
            <select value={s.currency} onChange={(e) => setSetting('currency', e.target.value)} aria-label="Currency"
              className="h-10 rounded-xl bg-surface-2 px-3 text-[16px] font-semibold outline-none">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Row>
        </Group>

        <SectionLabel>Data</SectionLabel>
        <Group>
          <Row icon={<ArchiveIcon size={18} />} label="Backup & restore" onClick={() => navigate('/more/backup')}><ChevronRight size={18} className="text-faint" /></Row>
        </Group>

        <SectionLabel>App status</SectionLabel>
        <Group>
          <Status label="Works offline" ok={offlineReady} value={offlineReady ? 'Ready' : 'Not yet cached'} />
          <Status label="Persistent storage" ok={!!persisted} value={persisted == null ? '…' : persisted ? 'Granted' : 'Not granted'} />
          <Status label="Installed app" ok={isStandalone()} value={isStandalone() ? 'Yes' : 'Browser tab'} />
          <Status label="Network" ok value={online ? 'Online' : 'Offline'} />
        </Group>
        <SectionLabel>Credits</SectionLabel>
        <Credits />
        <p className="px-4 pt-2 text-center text-[12px] text-muted">Life Tracker · everything stays on this phone</p>
      </Page>

      <LocationSheet open={open === 'location'} onClose={close} />
      <Picker open={open === 'method'} onClose={close} title="Calculation method" options={METHODS} value={s.prayerMethod} onPick={(v) => setSetting('prayerMethod', v)} />
      <Picker open={open === 'highlat'} onClose={close} title="High-latitude rule" options={HIGH_LAT_RULES} value={s.highLatRule} onPick={(v) => setSetting('highLatRule', v)} />
      <SplitEditor open={open === 'split'} onClose={close} today={today} />
      <ListsSheet open={open === 'lists'} onClose={close} />
      <CategoriesSheet open={open === 'categories'} onClose={close} />
    </>
  )
}

function Status({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <Row label={label}>
      <span className={`flex items-center gap-1.5 text-[15px] font-medium ${ok ? 'text-success' : 'text-muted'}`}>
        <span className={`h-2 w-2 rounded-full ${ok ? 'bg-success' : 'bg-faint'}`} />{value}
      </span>
    </Row>
  )
}

/** Sources and licenses. The Tanzil notice is shown verbatim from the bundled text file. */
function Credits() {
  const [notice, setNotice] = useState<string[] | null>(null)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (open && notice === null) loadQuran().then((q) => setNotice(q?.notice ?? []))
  }, [open, notice])
  return (
    <Group>
      <Row icon={<QuranIcon size={18} />} label="Quran text: Tanzil.net" detail={open ? 'Hide' : 'Show'} onClick={() => setOpen(!open)} />
      {open && (
        <div className="animate-fade-in px-4 py-3 text-[13px] leading-relaxed text-muted">
          <p className="mb-2">Uthmani text and Madani page data from the Tanzil Project, <a href="https://tanzil.net" className="font-semibold text-accent">tanzil.net</a>, bundled into the app unmodified.</p>
          {!META && <p>This build doesn’t include the Quran text.</p>}
          {notice?.length ? <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 font-sans text-[12px] whitespace-pre-wrap">{notice.join('\n').trim()}</pre> : null}
        </div>
      )}
      <Row label={<span className="text-[14px] text-muted">Tajweed mushaf: KFGQPC V4 (1441H) page fonts, surah-name and frame fonts © King Fahd Glorious Qur’an Printing Complex (all rights reserved; free for non-commercial, charitable use, not for sale), tajweed colour features by Ayman, Rania, Syeds, Naveed, Zahid, Tooba and Anza (Sadaqa-e-Jaria), published by the Quranic Universal Library (qul.tarteel.ai) and downloaded from it onto this phone. Page layout: QUL’s open data (mushaf layout 19). Rendering follows tlawat/remotion-mushaf-line (MIT).</span>} />
      <Row label={<span className="text-[14px] text-muted">Amiri Quran font by the Amiri Project (SIL Open Font License 1.1) · Inter font by Rasmus Andersson (SIL OFL 1.1) · Prayer times by adhan-js (MIT)</span>} />
    </Group>
  )
}
