import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { daysUntil } from '../../lib/dates'
import { db } from '../../lib/db'
import { habitShownOn } from '../../lib/habits'
import { navigate } from '../../lib/router'
import { useToday } from '../../lib/useToday'
import { ArchiveIcon, BookIcon, CakeIcon, CartIcon, GearIcon, HabitIcon, WalletIcon } from '../../components/Icons'
import { TopBar } from '../../components/TopBar'
import { Page } from '../../components/ui'
import { MOODS } from './Journal'
import { formatEUR } from '../../lib/finance'

function Tile({ path, label, sec, icon, detail, wide }: { path: string; label: string; sec: string; icon: ReactNode; detail?: ReactNode; wide?: boolean }) {
  return (
    <button type="button" data-sec={sec} onClick={() => navigate(path)}
      className={`pressable flex min-h-[132px] flex-col justify-between rounded-[24px] bg-surface p-4 text-left shadow-card ${wide ? 'col-span-2 min-h-0 flex-row items-center gap-3' : ''}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-accent-soft text-accent">{icon}</span>
      <span className={wide ? 'flex-1' : ''}>
        <span className="block text-[17px] font-semibold">{label}</span>
        {detail && <span className="block truncate text-[13px] text-muted">{detail}</span>}
      </span>
    </button>
  )
}

export function More() {
  const today = useToday()
  const habits = useLiveQuery(() => db.habits.toArray()) ?? []
  const checks = useLiveQuery(() => db.habitChecks.where('day').equals(today).count(), [today]) ?? 0
  const balance = useLiveQuery(() => db.finBalances.orderBy('day').last())
  const journal = useLiveQuery(() => db.journal.get(today), [today])
  const dates = useLiveQuery(() => db.importantDates.toArray()) ?? []
  const shoppingLeft = useLiveQuery(() => db.shoppingItems.filter((i) => !i.checked).count()) ?? 0
  const nextDate = [...dates].sort((a, b) => daysUntil(a, today) - daysUntil(b, today))[0]
  const nextIn = nextDate ? daysUntil(nextDate, today) : null
  const shown = habits.filter((h) => habitShownOn(h, today)).length
  const mood = MOODS.find((m) => m.value === journal?.mood)

  return (
    <>
      <TopBar title="More" backTo="/" />
      <Page>
        <div className="stagger grid grid-cols-2 gap-3">
          <Tile path="/more/habits" label="Habits" sec="habits" icon={<HabitIcon />} detail={shown ? `${Math.min(checks, shown)} of ${shown} today` : 'Build routines'} />
          <Tile path="/more/finance" label="Finance" sec="finance" icon={<WalletIcon />} detail={balance ? `${formatEUR(balance.amount)} balance` : 'Commerzbank sync'} />
          <Tile path="/more/journal" label="Journal" sec="journal" icon={<BookIcon />} detail={mood ? `${mood.emoji} ${mood.label} today` : journal?.text ? 'Written today' : 'How was today?'} />
          <Tile path="/more/dates" label="Important Dates" sec="dates" icon={<CakeIcon />}
            detail={nextDate ? `${nextDate.title} ${nextIn === 0 ? 'today 🎉' : nextIn === 1 ? 'tomorrow' : `in ${nextIn} days`}` : 'Birthdays & anniversaries'} />
          <Tile path="/more/shopping" label="Shopping List" sec="shopping" icon={<CartIcon />} detail={shoppingLeft ? `${shoppingLeft} item${shoppingLeft === 1 ? '' : 's'} to get` : 'Nothing to buy'} />
          <Tile path="/more/settings" label="Settings" sec="home" icon={<GearIcon />} detail="Prayer, targets, theme" />
          <Tile path="/more/backup" label="Backup" sec="home" icon={<ArchiveIcon />} detail="Export or restore your data" wide />
        </div>
      </Page>
    </>
  )
}
