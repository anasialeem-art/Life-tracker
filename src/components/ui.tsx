import type { ReactNode } from 'react'

export function Page({ children }: { children: ReactNode }) {
  return <div className="animate-page-in mx-auto flex max-w-xl flex-col gap-4 px-4 pt-2 pb-6">{children}</div>
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  const base = `rounded-2xl bg-surface p-4 ${className}`
  return onClick ? (
    <button type="button" onClick={onClick} className={`pressable block w-full text-left ${base}`}>{children}</button>
  ) : (
    <div className={base}>{children}</div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="px-1 pt-2 text-[13px] font-semibold uppercase tracking-wide text-muted">{children}</h2>
}

type ButtonVariant = 'primary' | 'secondary' | 'danger'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white',
  secondary: 'bg-surface-2 text-text',
  danger: 'bg-danger-soft text-danger',
}

export function Button({ children, onClick, variant = 'primary', disabled, className = '' }: {
  children: ReactNode
  onClick?: () => void
  variant?: ButtonVariant
  disabled?: boolean
  className?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`pressable flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold disabled:opacity-40 ${VARIANTS[variant]} ${className}`}>
      {children}
    </button>
  )
}

/** Segmented control, e.g. theme picker or the To-Do view toggle. */
export function Segmented<T extends string>({ value, options, onChange }: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={o.value === value}
          className={`min-h-10 flex-1 rounded-lg text-sm font-semibold transition-all duration-200 ${o.value === value ? 'bg-surface-raised text-text shadow-sm' : 'text-muted'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6 py-10 text-center">
      <p className="text-[15px] font-semibold">{title}</p>
      {children && <p className="text-sm text-muted">{children}</p>}
    </div>
  )
}
