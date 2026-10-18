import { useLiveQuery } from 'dexie-react-hooks'
import { backupOverdueDays } from '../lib/backup'
import { longDate, weekdayName } from '../lib/day'
import { navigate } from '../lib/router'
import { useToday } from '../lib/useToday'
import { CheckListIcon, DumbbellIcon, FlameIcon, GridIcon, MoonIcon, PillIcon } from '../components/Icons'
import { IconButton, TopBar } from '../components/TopBar'
import { Card, Page } from '../components/ui'

function greeting(hour: number): string {
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// Card shells in the final fixed order. Each fills in as its tab is built (step 7 wires the data).
const CARDS = [
  { path: '/prayer', title: 'Prayer', Icon: MoonIcon, hint: 'Next prayer and today’s five' },
  { path: '/meds', title: 'Medications', Icon: PillIcon, hint: 'Doses taken and still due' },
  { path: '/todo', title: 'To-dos', Icon: CheckListIcon, hint: 'Due today and overdue' },
  { path: '/fitness', title: 'Training', Icon: DumbbellIcon, hint: 'Today’s split day' },
  { path: '/fitness', title: 'Nutrition', Icon: FlameIcon, hint: 'Calories and protein' },
]

export function Home() {
  const today = useToday()
  const overdue = useLiveQuery(() => backupOverdueDays(), [today])

  return (
    <>
      <TopBar
        title={greeting(new Date().getHours())}
        subtitle={`${weekdayName(today)}, ${longDate(today)}`}
        actions={<IconButton label="More" onClick={() => navigate('/more')}><GridIcon /></IconButton>}
      />
      <Page>
        {overdue != null && (
          <Card onClick={() => navigate('/more/backup')} className="bg-accent-soft">
            <p className="text-[15px] font-semibold text-accent">Time for a backup</p>
            <p className="text-sm text-muted">Last backup {overdue} days ago. Tap to export your data.</p>
          </Card>
        )}
        {CARDS.map(({ path, title, Icon, hint }) => (
          <Card key={title} onClick={() => navigate(path, { replace: true })}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent"><Icon size={22} /></span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{title}</p>
                <p className="text-sm text-muted">{hint}</p>
              </div>
            </div>
          </Card>
        ))}
      </Page>
    </>
  )
}
