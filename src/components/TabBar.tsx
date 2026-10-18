import type { ComponentType } from 'react'
import { navigate } from '../lib/router'
import { CheckListIcon, DumbbellIcon, HomeIcon, MoonIcon, PillIcon, type IconProps } from './Icons'

export interface Tab {
  path: string
  label: string
  sec: string
  Icon: ComponentType<IconProps>
}

export const TABS: Tab[] = [
  { path: '/', label: 'Home', sec: 'home', Icon: HomeIcon },
  { path: '/meds', label: 'Meds', sec: 'meds', Icon: PillIcon },
  { path: '/prayer', label: 'Prayer', sec: 'prayer', Icon: MoonIcon },
  { path: '/todo', label: 'To-Do', sec: 'todo', Icon: CheckListIcon },
  { path: '/fitness', label: 'Fitness', sec: 'fitness', Icon: DumbbellIcon },
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
      <ul className="mx-auto flex max-w-xl px-1">
        {TABS.map(({ path: p, label, sec, Icon }) => {
          const isActive = p === active
          return (
            <li key={p} className="flex-1" data-sec={sec}>
              <button
                type="button"
                onClick={() => p !== path && navigate(p, { replace: true })}
                aria-current={isActive ? 'page' : undefined}
                className={`flex h-[62px] w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors duration-200 ${isActive ? 'text-accent' : 'text-muted'}`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-all duration-300 ease-[cubic-bezier(.2,.9,.25,1)] ${isActive ? 'scale-100 bg-accent-soft' : 'scale-90'}`}>
                  <Icon size={23} strokeWidth={isActive ? 2.2 : 1.9} />
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
