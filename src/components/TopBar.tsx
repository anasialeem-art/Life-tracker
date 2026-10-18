import type { ReactNode } from 'react'
import { back } from '../lib/router'
import { ChevronLeft } from './Icons'

interface TopBarProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Shows a back chevron that returns to `backTo` (or the previous page). */
  backTo?: string
  /** Corner buttons, e.g. the overview calendar or "Open Lyfta". */
  actions?: ReactNode
}

export function TopBar({ title, subtitle, backTo, actions }: TopBarProps) {
  return (
    <header className="sticky top-0 z-20 bg-bg/85 pt-safe backdrop-blur-xl">
      <div className="flex min-h-14 items-center gap-1 px-4">
        {backTo !== undefined && (
          <button type="button" onClick={() => back(backTo)} aria-label="Back"
            className="pressable -ml-2 flex h-11 w-11 items-center justify-center rounded-full text-accent">
            <ChevronLeft size={26} />
          </button>
        )}
        <div className="min-w-0 flex-1 py-2">
          <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="-mr-2 flex items-center gap-1">{actions}</div>}
      </div>
    </header>
  )
}

/** Round icon button for top-bar corners. */
export function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className="pressable flex h-11 w-11 items-center justify-center rounded-full text-text active:bg-surface-2">
      {children}
    </button>
  )
}
