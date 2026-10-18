import { useEffect, useRef } from 'react'

// Android's back gesture should close the topmost overlay (sheet, focus card)
// rather than leave the page. Each open overlay pushes a history entry; a back
// press pops only the top one. Closing an overlay from the UI removes its entry
// without triggering the ones underneath.

interface Entry { close: () => void }

const stack: Entry[] = []
let ignorePops = 0

window.addEventListener('popstate', () => {
  if (ignorePops > 0) {
    ignorePops--
    return
  }
  stack.pop()?.close()
})

// Several overlays can close in the same tick (a confirm and the sheet under
// it). Chrome may merge back-to-back history.back() calls, so batch them into
// a single history.go(-n), which produces one popstate.
let pendingBack = 0

function scheduleBack() {
  pendingBack++
  if (pendingBack > 1) return
  setTimeout(() => {
    const n = pendingBack
    pendingBack = 0
    ignorePops++
    history.go(-n)
  }, 0)
}

function push(close: () => void): () => void {
  const entry: Entry = { close }
  stack.push(entry)
  history.pushState({ overlay: true }, '')
  return () => {
    const i = stack.indexOf(entry)
    if (i < 0) return // already popped by the back gesture
    stack.splice(i, 1)
    scheduleBack()
  }
}

/** While `open`, a back press calls `onClose` (only for the topmost overlay). */
export function useBackClose(open: boolean, onClose: () => void) {
  const ref = useRef(onClose)
  ref.current = onClose
  useEffect(() => {
    if (!open) return
    return push(() => ref.current())
  }, [open])
}
