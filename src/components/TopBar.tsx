import { useEffect, useState, type ReactNode } from 'react'
import { back } from '../lib/router'
import { ChevronLeft } from './Icons'

function useScrolled(threshold = 28): boolean {
  const [scrolled, setScrolled] = useState(() => window.scrollY > threshold)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  return scrolled
}

interface TopBarProps {
  title: ReactNode
  subtitle?: ReactNode
  /** Shows a back chevron that returns to `backTo` (or the previous page). */
  backTo?: string
  /** Corner buttons, e.g. the overview calendar or "Open Lyfta". */
  actions?: ReactNode
  /** Small label above the large title (e.g. date on Home). */
  eyebrow?: ReactNode
}

/** iOS-style large title that collapses into a compact bar on scroll. */
export function TopBar({ title, subtitle, backTo, actions, eyebrow }: TopBarProps) {
  const scrolled = useScrolled()
  return (
    <>
      <header className={`sticky top-0 z-20 pt-safe transition-[background-color,border-color] duration-200 ${scrolled ? 'border-b border-line bg-bg/80 backdrop-blur-xl backdrop-saturate-150' : 'border-b border-transparent bg-bg'}`}>
        <div className="mx-auto flex h-12 max-w-xl items-center gap-1 px-2">
          <div className="flex w-24 items-center">
            {backTo !== undefined && (
              <button type="button" onClick={() => back(backTo)} aria-label="Back"
                className="pressable flex h-11 w-11 items-center justify-center rounded-full text-accent">
                <ChevronLeft size={26} />
              </button>
            )}
          </div>
          <p className={`min-w-0 flex-1 truncate text-center text-[16px] font-semibold transition-all duration-200 ${scrolled ? 'opacity-100' : 'translate-y-1 opacity-0'}`}>{title}</p>
          <div className="flex w-24 items-center justify-end gap-0.5">{actions}</div>
        </div>
      </header>
      <div className={`mx-auto max-w-xl px-5 pt-1 pb-3 transition-opacity duration-200 ${scrolled ? 'opacity-0' : ''}`}>
        {eyebrow && <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-accent">{eyebrow}</p>}
        <h1 className="text-[32px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="text-[15px] text-muted">{subtitle}</p>}
      </div>
    </>
  )
}

/** Round icon button for top-bar corners. */
export function IconButton({ label, onClick, children, tinted }: { label: string; onClick: () => void; children: ReactNode; tinted?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className={`pressable flex h-10 w-10 items-center justify-center rounded-full ${tinted ? 'bg-accent-soft text-accent' : 'text-accent active:bg-surface-2'}`}>
      {children}
    </button>
  )
}
