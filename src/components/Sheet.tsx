import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useBackClose } from '../lib/backstack'
import { XIcon } from './Icons'
import { useSection } from './ui'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  /** Button shown at the top right, e.g. Save. */
  action?: ReactNode
}

const CLOSE_DRAG_PX = 110

/**
 * Bottom sheet for add/edit forms. Closes on backdrop tap, swipe down on the
 * header, the × button, or Android back. Animates out before unmounting.
 */
export function Sheet({ open, onClose, title, children, action }: SheetProps) {
  const section = useSection()
  const [mounted, setMounted] = useState(open)
  const [closing, setClosing] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<number | null>(null)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
      setDragY(0)
    } else if (mounted) {
      setClosing(true)
      const t = setTimeout(() => setMounted(false), 230)
      return () => clearTimeout(t)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Android back gesture closes the sheet instead of leaving the page.
  useBackClose(open, onClose)

  // Lock page scroll behind the sheet.
  useEffect(() => {
    if (!mounted) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mounted])

  if (!mounted) return null

  const onPointerDown = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    start.current = e.clientY
    setDragging(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (start.current !== null) setDragY(Math.max(0, e.clientY - start.current))
  }
  const onPointerUp = () => {
    if (start.current === null) return
    start.current = null
    setDragging(false)
    if (dragY > CLOSE_DRAG_PX) onClose()
    else setDragY(0)
  }

  return createPortal(
    <div data-sec={section} className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className={`absolute inset-0 bg-black/45 ${closing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={onClose} />
      <div className={closing ? 'animate-sheet-down' : 'animate-sheet-up'}>
        <div
          className="relative mx-auto flex max-h-[92dvh] max-w-xl flex-col rounded-t-[28px] bg-surface pb-safe shadow-[0_-8px_40px_rgb(0_0_0/0.18)]"
          style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: dragging ? 'none' : 'transform 260ms cubic-bezier(.2,.9,.25,1)' }}
        >
          <div className="shrink-0 touch-none rounded-t-[28px] pt-2"
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            <div className="mx-auto h-[5px] w-10 rounded-full bg-faint/60" />
            <div className="flex min-h-12 items-center gap-2 px-3 pt-1">
              <button type="button" onClick={onClose} aria-label="Close"
                className="pressable flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-muted"><XIcon size={18} strokeWidth={2.4} /></button>
              <h2 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold">{title}</h2>
              <div className="flex min-w-9 justify-end">{action}</div>
            </div>
          </div>
          <div className="overflow-y-auto overscroll-contain px-5 pt-2 pb-6">{children}</div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Yes/no confirmation in a small sheet. */
export function ConfirmSheet({ open, onClose, title, message, confirmLabel, onConfirm, danger = true }: {
  open: boolean
  onClose: () => void
  title: string
  message: ReactNode
  confirmLabel: string
  onConfirm: () => void
  danger?: boolean
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="pb-5 text-center text-[15px] leading-relaxed text-muted">{message}</p>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => { onConfirm(); onClose() }}
          className={`pressable min-h-[50px] rounded-2xl text-[16px] font-semibold ${danger ? 'bg-danger text-white' : 'bg-accent text-white'}`}>{confirmLabel}</button>
        <button type="button" onClick={onClose} className="pressable min-h-[50px] rounded-2xl bg-surface-2 text-[16px] font-semibold">Cancel</button>
      </div>
    </Sheet>
  )
}

/** Primary "Save"/"Add" pill for a sheet's top-right corner. */
export function SheetAction({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="pressable min-h-9 rounded-full bg-accent px-4 text-[15px] font-semibold text-white disabled:opacity-35">{children}</button>
  )
}
