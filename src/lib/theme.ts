import { useEffect } from 'react'
import type { Settings } from './settings'

type Theme = Settings['theme']

const THEME_COLORS = { light: '#f5f5f7', dark: '#000000' }

const darkQuery = () => matchMedia('(prefers-color-scheme: dark)')

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && darkQuery().matches)
  document.documentElement.classList.toggle('dark', dark)
  // Keeps the Android status bar matching the app background.
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light)
  // Mirror to localStorage so index.html can apply it before first paint.
  try {
    localStorage.setItem('theme', theme)
  } catch {
    // Storage blocked: the theme still applies once the app loads.
  }
}

/** Applies the theme now and follows OS changes while set to "system". */
export function useApplyTheme(theme: Theme) {
  useEffect(() => {
    apply(theme)
    if (theme !== 'system') return
    const mq = darkQuery()
    const onChange = () => apply('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [theme])
}
