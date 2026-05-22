import { useEffect, useState } from 'react'
import { getTheme, toggleTheme, THEME_EVENT, type Theme } from '../lib/theme'

// Sun / moon icon button next to the language switch. Reads the current
// theme from localStorage/OS preference and re-renders on any theme event
// (multi-tab, programmatic changes).
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => getTheme())

  useEffect(() => {
    const sync = () => setTheme(getTheme())
    window.addEventListener(THEME_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(THEME_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'switch to dark theme' : 'switch to light theme'}
      title={theme === 'light' ? 'тёмная тема' : 'светлая тема'}
    >
      {theme === 'light' ? (
        // Moon — clicking switches to dark
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ) : (
        // Sun — clicking switches to light
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
          <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
          <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
        </svg>
      )}
    </button>
  )
}
