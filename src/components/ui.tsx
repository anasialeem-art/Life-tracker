import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CheckIcon, MinusIcon, PlusIcon } from './Icons'

/** Section key (meds, prayer, …) so portaled sheets keep the page's accent color. */
export const SectionContext = createContext<string>('home')
export const useSection = () => useContext(SectionContext)

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto flex max-w-xl flex-col gap-3 px-4 pt-1 pb-8 ${className}`}>{children}</div>
}

export function Card({ children, className = '', onClick, style }: {
  children: ReactNode
  className?: string
  onClick?: () => void
  style?: React.CSSProperties
}) {
  const base = `rounded-[22px] bg-surface p-4 shadow-card ${className}`
  return onClick ? (
    <button type="button" onClick={onClick} style={style} className={`pressable block w-full text-left ${base}`}>{children}</button>
  ) : (
    <div className={base} style={style}>{children}</div>
  )
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between px-1 pt-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{children}</h2>
      {action}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'tinted' | 'danger' | 'plain'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white shadow-[0_6px_16px_-8px_var(--accent)]',
  secondary: 'bg-surface-2 text-text',
  tinted: 'bg-accent-soft text-accent',
  danger: 'bg-danger-soft text-danger',
  plain: 'text-accent',
}

export function Button({ children, onClick, variant = 'primary', disabled, className = '', small, type = 'button' }: {
  children: ReactNode
  onClick?: () => void
  variant?: ButtonVariant
  disabled?: boolean
  className?: string
  small?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`pressable flex items-center justify-center gap-2 font-semibold disabled:pointer-events-none disabled:opacity-40 ${small ? 'min-h-9 rounded-full px-3.5 text-[14px]' : 'min-h-[50px] rounded-2xl px-4 text-[16px]'} ${VARIANTS[variant]} ${className}`}>
      {children}
    </button>
  )
}

/** Segmented control, e.g. theme picker or the To-Do view toggle. */
export function Segmented<T extends string>({ value, options, onChange, disabled, size = 'md' }: {
  value: T | null
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const index = options.findIndex((o) => o.value === value)
  return (
    <div className={`relative flex rounded-[13px] bg-surface-2 p-[3px] ${disabled ? 'opacity-50' : ''}`}>
      {index >= 0 && (
        <span className="absolute top-[3px] bottom-[3px] rounded-[10px] bg-surface-raised shadow-[0_1px_4px_rgb(0_0_0/0.12)] transition-transform duration-300 ease-[cubic-bezier(.2,.9,.25,1)]"
          style={{ width: `calc((100% - 6px) / ${options.length})`, transform: `translateX(${index * 100}%)` }} />
      )}
      {options.map((o) => (
        <button key={o.value} type="button" disabled={disabled} onClick={() => onChange(o.value)} aria-pressed={o.value === value}
          className={`relative z-10 flex-1 rounded-[10px] font-semibold transition-colors duration-200 ${size === 'sm' ? 'min-h-8 text-[13px]' : 'min-h-[38px] text-[14px]'} ${o.value === value ? 'text-text' : 'text-muted'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-8 text-center">
      {icon && <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">{icon}</div>}
      <p className="text-[16px] font-semibold">{title}</p>
      {children && <p className="max-w-64 text-[14px] leading-snug text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

/** Round animated checkbox. */
export function Check({ checked, onChange, disabled, color, size = 28, label }: {
  checked: boolean
  onChange?: (v: boolean) => void
  disabled?: boolean
  color?: string
  size?: number
  label?: string
}) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} aria-label={label} disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange?.(!checked) }}
      className="flex shrink-0 items-center justify-center disabled:opacity-40"
      style={{ width: size + 12, height: size + 12, margin: -6 }}>
      <span key={String(checked)}
        className={`flex items-center justify-center rounded-full border-2 transition-colors duration-200 ${checked ? 'animate-pop border-transparent text-white' : 'border-faint'}`}
        style={{ width: size, height: size, background: checked ? (color ?? 'var(--accent)') : undefined }}>
        {checked && (
          <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
            <path className="animate-check" d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        )}
      </span>
    </button>
  )
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-40 ${checked ? 'bg-accent' : 'bg-surface-2 ring-1 ring-line ring-inset'}`}>
      <span className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.2)] transition-transform duration-250 ease-[cubic-bezier(.2,.9,.25,1)] ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

/** Grouped settings-style rows. */
export function Group({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`divide-y divide-line overflow-hidden rounded-[22px] bg-surface shadow-card ${className}`}>{children}</div>
}

export function Row({ icon, label, detail, onClick, children, danger }: {
  icon?: ReactNode
  label: ReactNode
  detail?: ReactNode
  onClick?: () => void
  children?: ReactNode
  danger?: boolean
}) {
  const body = (
    <>
      {icon && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent">{icon}</span>}
      <span className={`min-w-0 flex-1 text-[16px] ${danger ? 'text-danger' : ''}`}>{label}</span>
      {detail !== undefined && <span className="max-w-[55%] truncate text-right text-[15px] text-muted">{detail}</span>}
      {children}
    </>
  )
  const cls = 'flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left'
  return onClick ? <button type="button" onClick={onClick} className={`${cls} active:bg-surface-2`}>{body}</button> : <div className={cls}>{body}</div>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1.5">
      <span className="px-1 text-[13px] font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="px-1 text-[12px] text-muted">{hint}</span>}
    </div>
  )
}

export const inputCls = 'min-h-[50px] w-full rounded-2xl bg-surface-2 px-4 text-[16px] text-text outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/50'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />
}

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-1 rounded-2xl bg-surface-2 p-1">
      <button type="button" aria-label="Decrease" disabled={value <= min} onClick={() => onChange(value - 1)}
        className="pressable flex h-11 w-11 items-center justify-center rounded-xl bg-surface-raised text-accent disabled:opacity-30"><MinusIcon size={20} /></button>
      <span className="tabular min-w-10 text-center text-[17px] font-semibold">{value}</span>
      <button type="button" aria-label="Increase" disabled={value >= max} onClick={() => onChange(value + 1)}
        className="pressable flex h-11 w-11 items-center justify-center rounded-xl bg-surface-raised text-accent disabled:opacity-30"><PlusIcon size={20} /></button>
    </div>
  )
}

export function Chip({ children, active, onClick, color }: { children: ReactNode; active?: boolean; onClick?: () => void; color?: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className={`pressable flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-semibold transition-colors ${active ? 'text-white' : 'bg-surface-2 text-text'}`}
      style={active ? { background: color ?? 'var(--accent)' } : undefined}>
      {active && <CheckIcon size={15} strokeWidth={3} />}
      {children}
    </button>
  )
}

export function IconBadge({ children, color, size = 40 }: { children: ReactNode; color?: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[12px]"
      style={{ width: size, height: size, background: color ? `color-mix(in srgb, ${color} 15%, transparent)` : 'var(--accent-soft)', color: color ?? 'var(--accent)' }}>
      {children}
    </span>
  )
}

export function ProgressBar({ value, max, color, height = 10 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="overflow-hidden rounded-full bg-surface-2" style={{ height }}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(.2,.9,.25,1)]"
        style={{ width: `${pct}%`, background: color ?? 'var(--accent)' }} />
    </div>
  )
}

/** Circular progress ring with optional centered content. */
export function Ring({ value, max, size = 64, stroke = 7, color, children }: {
  value: number
  max: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color ?? 'var(--accent)'} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(.2,.9,.25,1)]" />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  )
}

/** Brief confirmation toast. */
export function useToast(): [ReactNode, (msg: string) => void] {
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null)
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(() => setMsg(null), 2200)
    return () => clearTimeout(t)
  }, [msg])
  const node = msg ? createPortal(
    <div key={msg.n} className="animate-toast-in pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4">
      <div className="rounded-full bg-text px-4 py-2.5 text-[14px] font-semibold text-bg shadow-xl">{msg.text}</div>
    </div>,
    document.body,
  ) : null
  return [node, (text: string) => setMsg({ text, n: Date.now() })]
}
