import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
}

const CLOSE_DRAG_PX = 110

/** Bottom sheet for add/edit forms. Closes on backdrop tap, swipe down on the handle, or Android back. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const [dragY, setDragY] = useState(0)
  const start = useRef<number | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Android back gesture closes the sheet instead of leaving the page.
  useEffect(() => {
    if (!open) return
    history.pushState({ sheet: true }, '')
    const onPop = () => closeRef.current()
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (history.state?.sheet) history.back()
    }
  }, [open])

  useEffect(() => {
    if (open) setDragY(0)
  }, [open])

  if (!open) return null

  const onPointerDown = (e: PointerEvent) => {
    start.current = e.clientY
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (start.current !== null) setDragY(Math.max(0, e.clientY - start.current))
  }
  const onPointerUp = () => {
    start.current = null
    if (dragY > CLOSE_DRAG_PX) onClose()
    else setDragY(0)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="animate-sheet-up relative max-h-[90dvh] overflow-y-auto rounded-t-3xl bg-surface pb-safe shadow-2xl"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: start.current === null ? 'transform 200ms ease' : 'none' }}
      >
        <div className="sticky top-0 z-10 bg-surface pt-2 pb-1 touch-none"
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <div className="mx-auto h-1.5 w-10 rounded-full bg-surface-2" />
          {title && <h2 className="px-5 pt-3 pb-1 text-lg font-semibold">{title}</h2>}
        </div>
        <div className="px-5 pt-2 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
