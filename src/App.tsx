import { Component, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ensureFirstUse } from './lib/db'
import { usePath } from './lib/router'
import { SettingsContext, useSettingsQuery } from './lib/settings'
import { isNativeApp, setupNativeBack } from './lib/native'
import { requestPersistentStorage } from './lib/storage'
import { storedTheme, useApplyTheme } from './lib/theme'
import { TabBar } from './components/TabBar'
import { SectionContext } from './components/ui'
import { UpdatePrompt } from './components/UpdatePrompt'
import { Home } from './pages/Home'
import { Finance } from './pages/finance/Finance'
import { FinanceSettings } from './pages/finance/FinanceSettings'
import { Rules } from './pages/finance/Rules'
import { Fitness } from './pages/fitness/Fitness'
import { Meds } from './pages/meds/Meds'
import { Backup } from './pages/more/Backup'
import { Habits } from './pages/more/Habits'
import { ImportantDates } from './pages/more/ImportantDates'
import { Shopping } from './pages/more/Shopping'
import { Journal } from './pages/more/Journal'
import { More } from './pages/more/More'
import { Settings } from './pages/more/Settings'
import { Prayer } from './pages/prayer/Prayer'
import { Todo } from './pages/todo/Todo'

interface Route { sec: string; render: () => ReactNode }

/** The five tabs stay mounted once visited, so switching is instant and keeps each tab's state. */
const TABS: Record<string, Route> = {
  '/': { sec: 'home', render: () => <Home /> },
  '/meds': { sec: 'meds', render: () => <Meds /> },
  '/prayer': { sec: 'prayer', render: () => <Prayer /> },
  '/todo': { sec: 'todo', render: () => <Todo /> },
  '/fitness': { sec: 'fitness', render: () => <Fitness /> },
}

/** Pages pushed on top (from More); these mount fresh with a short slide-in. */
const PAGES: Record<string, Route> = {
  '/more': { sec: 'home', render: () => <More /> },
  '/more/habits': { sec: 'habits', render: () => <Habits /> },
  '/more/finance': { sec: 'finance', render: () => <Finance /> },
  '/more/finance/settings': { sec: 'finance', render: () => <FinanceSettings /> },
  '/more/finance/rules': { sec: 'finance', render: () => <Rules /> },
  '/more/journal': { sec: 'journal', render: () => <Journal /> },
  '/more/settings': { sec: 'home', render: () => <Settings /> },
  '/more/backup': { sec: 'home', render: () => <Backup /> },
  '/more/dates': { sec: 'dates', render: () => <ImportantDates /> },
  '/more/shopping': { sec: 'shopping', render: () => <Shopping /> },
}

/** Shows what went wrong instead of a blank screen, with a way out. */
class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-3 px-5 pt-[max(env(safe-area-inset-top),24px)]">
        <h1 className="text-[26px] font-bold">Something went wrong</h1>
        <p className="text-[15px] text-muted">Your data is safe. Please send a screenshot of this screen so it can be fixed.</p>
        <pre className="overflow-x-auto rounded-2xl bg-surface p-4 text-[12px] whitespace-pre-wrap text-danger">
          {this.state.error.message}{'\n'}{this.state.error.stack?.split('\n').slice(0, 6).join('\n')}
        </pre>
        <button type="button" onClick={() => location.reload()} className="pressable min-h-[50px] rounded-2xl bg-accent text-[16px] font-semibold text-white">Reload app</button>
      </div>
    )
  }
}

export default function App() {
  const path = usePath()
  const settings = useSettingsQuery()
  useApplyTheme(settings?.theme ?? storedTheme())

  useEffect(() => {
    requestPersistentStorage()
    ensureFirstUse()
    setupNativeBack()
  }, [])

  const isTab = path in TABS
  const page = isTab ? null : PAGES[path] ?? null
  const activeTab = isTab ? path : page ? null : '/'
  const [visited, setVisited] = useState<Set<string>>(() => new Set([activeTab ?? '/']))
  if (activeTab && !visited.has(activeTab)) setVisited(new Set(visited).add(activeTab))

  // Remember each screen's scroll position; pushed pages start at the top.
  const scrolls = useRef(new Map<string, number>())
  const prevPath = useRef(path)
  useLayoutEffect(() => {
    scrolls.current.set(prevPath.current, window.scrollY)
    prevPath.current = path
    window.scrollTo(0, isTab ? scrolls.current.get(path) ?? 0 : 0)
  }, [path, isTab])

  return (
    <SettingsContext.Provider value={settings}>
      <div className="min-h-dvh pl-safe pr-safe pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        {Object.entries(TABS).filter(([p]) => visited.has(p)).map(([p, r]) => (
          <SectionContext.Provider key={p} value={r.sec}>
            <div data-sec={r.sec} hidden={p !== activeTab}>
              <ErrorBoundary resetKey={path}>{r.render()}</ErrorBoundary>
            </div>
          </SectionContext.Provider>
        ))}
        {page && (
          <SectionContext.Provider value={page.sec}>
            <main key={path} data-sec={page.sec} className="animate-push-in">
              <ErrorBoundary resetKey={path}>{page.render()}</ErrorBoundary>
            </main>
          </SectionContext.Provider>
        )}
        <div data-sec={page?.sec ?? TABS[activeTab ?? '/'].sec}>
          <TabBar path={path} />
        </div>
        {/* The Android app ships its files inside the APK; a service worker there would only serve stale copies after an update. */}
        {!isNativeApp() && <UpdatePrompt />}
      </div>
    </SettingsContext.Provider>
  )
}
