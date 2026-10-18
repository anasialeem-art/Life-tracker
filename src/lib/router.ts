import { useEffect, useState } from 'react'

// Minimal hash router. Hash URLs survive any static host path and need no
// server rewrites, and Android's back gesture walks the hash history.

export function currentPath(): string {
  return location.hash.replace(/^#/, '') || '/'
}

export function navigate(path: string, { replace = false } = {}) {
  const hash = `#${path}`
  if (replace) history.replaceState(null, '', hash)
  else if (location.hash !== hash) history.pushState(null, '', hash)
  window.dispatchEvent(new Event('hashchange'))
}

export function back(fallback = '/') {
  if (history.length > 1) history.back()
  else navigate(fallback, { replace: true })
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const update = () => setPath(currentPath())
    window.addEventListener('hashchange', update)
    window.addEventListener('popstate', update)
    return () => {
      window.removeEventListener('hashchange', update)
      window.removeEventListener('popstate', update)
    }
  }, [])
  return path
}
