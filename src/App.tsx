import { useEffect } from 'react'
import { ensureFirstUse } from './lib/db'
import { usePath } from './lib/router'
import { useSetting } from './lib/settings'
import { requestPersistentStorage } from './lib/storage'
import { useApplyTheme } from './lib/theme'
import { TabBar } from './components/TabBar'
import { SectionContext } from './components/ui'
import { UpdatePrompt } from './components/UpdatePrompt'
import { Home } from './pages/Home'
import { Fitness } from './pages/fitness/Fitness'
import { Meds } from './pages/meds/Meds'
import { Backup } from './pages/more/Backup'
import { Habits } from './pages/more/Habits'
import { Journal } from './pages/more/Journal'
import { Money } from './pages/more/Money'
import { More } from './pages/more/More'
import { Settings } from './pages/more/Settings'
import { Prayer } from './pages/prayer/Prayer'
import { Todo } from './pages/todo/Todo'

const ROUTES: Record<string, { sec: string; render: () => React.ReactNode }> = {
  '/': { sec: 'home', render: () => <Home /> },
  '/meds': { sec: 'meds', render: () => <Meds /> },
  '/prayer': { sec: 'prayer', render: () => <Prayer /> },
  '/todo': { sec: 'todo', render: () => <Todo /> },
  '/fitness': { sec: 'fitness', render: () => <Fitness /> },
  '/more': { sec: 'home', render: () => <More /> },
  '/more/habits': { sec: 'habits', render: () => <Habits /> },
  '/more/money': { sec: 'money', render: () => <Money /> },
  '/more/journal': { sec: 'journal', render: () => <Journal /> },
  '/more/settings': { sec: 'home', render: () => <Settings /> },
  '/more/backup': { sec: 'home', render: () => <Backup /> },
}

export default function App() {
  const path = usePath()
  const theme = useSetting('theme')
  useApplyTheme(theme)

  useEffect(() => {
    requestPersistentStorage()
    ensureFirstUse()
  }, [])

  // Each page starts scrolled to the top.
  useEffect(() => window.scrollTo(0, 0), [path])

  const route = ROUTES[path] ?? ROUTES['/']

  return (
    <SectionContext.Provider value={route.sec}>
      <div data-sec={route.sec} className="min-h-dvh pl-safe pr-safe pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <main key={path} className="animate-page-in">{route.render()}</main>
        <TabBar path={path} />
        <UpdatePrompt />
      </div>
    </SectionContext.Provider>
  )
}
