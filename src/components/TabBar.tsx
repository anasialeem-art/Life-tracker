import type { ComponentType, SVGProps } from 'react'
import { navigate } from '../lib/router'
import { CheckListIcon, DumbbellIcon, HomeIcon, MoonIcon, PillIcon } from './Icons'

export interface Tab {
  path: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
}

export const TABS: Tab[] = [
  { path: '/', label: 'Home', Icon: HomeIcon },
  { path: '/meds', label: 'Meds', Icon: PillIcon },
  { path: '/prayer', label: 'Prayer', Icon: MoonIcon },
  { path: '/todo', label: 'To-Do', Icon: CheckListIcon },
  { path: '/fitness', label: 'Fitness', Icon: DumbbellIcon },
]

/** Which tab a path belongs to. More pages open from Home, so they highlight Home. */
export function tabFor(path: string): string {
  const match = TABS.find((t) => t.path !== '/' && (path === t.path || path.startsWith(`${t.path}/`)))
  return match?.path ?? '/'
}

export function TabBar({ path }: { path: string }) {
  const active = tabFor(path)
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-tabbar pb-safe pl-safe pr-safe backdrop-blur-xl backdrop-saturate-150">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ path: p, label, Icon }) => {
          const isActive = p === active
          return (
            <li key={p} className="flex-1">
              <button
                type="button"
                onClick={() => navigate(p, { replace: true })}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${isActive ? 'text-accent' : 'text-muted'}`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200 ${isActive ? 'bg-accent-soft' : ''}`}>
                  <Icon size={22} strokeWidth={isActive ? 2.2 : 1.9} />
                </span>
                {label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
