import { navigate } from '../lib/router'
import { ArchiveIcon, BookIcon, GearIcon, HabitIcon, WalletIcon } from '../components/Icons'
import { TopBar } from '../components/TopBar'
import { Page } from '../components/ui'

const TILES = [
  { path: '/more/habits', label: 'Habits', Icon: HabitIcon },
  { path: '/more/money', label: 'Money', Icon: WalletIcon },
  { path: '/more/journal', label: 'Journal', Icon: BookIcon },
  { path: '/more/settings', label: 'Settings', Icon: GearIcon },
  { path: '/more/backup', label: 'Backup', Icon: ArchiveIcon },
]

export function More() {
  return (
    <>
      <TopBar title="More" backTo="/" />
      <Page>
        <div className="grid grid-cols-2 gap-3">
          {TILES.map(({ path, label, Icon }) => (
            <button key={path} type="button" onClick={() => navigate(path)}
              className="pressable flex aspect-[4/3] flex-col justify-between rounded-2xl bg-surface p-4 text-left">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon /></span>
              <span className="text-[16px] font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </Page>
    </>
  )
}
