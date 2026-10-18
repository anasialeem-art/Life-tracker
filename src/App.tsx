import { useEffect } from 'react'
import { ensureFirstUse } from './lib/db'
import { usePath } from './lib/router'
import { useSetting } from './lib/settings'
import { requestPersistentStorage } from './lib/storage'
import { useApplyTheme } from './lib/theme'
import { TabBar } from './components/TabBar'
import { UpdatePrompt } from './components/UpdatePrompt'
import { Backup } from './pages/Backup'
import { Home } from './pages/Home'
import { More } from './pages/More'
import { Placeholder } from './pages/Placeholder'
import { Settings } from './pages/Settings'

function route(path: string) {
  switch (path) {
    case '/meds': return <Placeholder title="Meds" step={2} withDayNav />
    case '/prayer': return <Placeholder title="Prayer" step={3} />
    case '/todo': return <Placeholder title="To-Do" step={4} withDayNav />
    case '/fitness': return <Placeholder title="Fitness" step={5} withDayNav />
    case '/more': return <More />
    case '/more/habits': return <Placeholder title="Habits" step={6} withDayNav />
    case '/more/money': return <Placeholder title="Money" step={6} />
    case '/more/journal': return <Placeholder title="Journal" step={6} withDayNav />
    case '/more/settings': return <Settings />
    case '/more/backup': return <Backup />
    default: return <Home />
  }
}

export default function App() {
  const path = usePath()
  const theme = useSetting('theme')
  useApplyTheme(theme)

  useEffect(() => {
    requestPersistentStorage()
    ensureFirstUse()
  }, [])

  // Each tab keeps its own scroll position starting at the top.
  useEffect(() => window.scrollTo(0, 0), [path])

  return (
    <div className="min-h-full pl-safe pr-safe pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <main key={path}>{route(path)}</main>
      <TabBar path={path} />
      <UpdatePrompt />
    </div>
  )
}
