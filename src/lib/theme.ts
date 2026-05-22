// Theme switching lives in the DOM (data-theme attribute on <html>) so a
// single CSS variable block in App.css covers every component. Preference is
// persisted in localStorage and falls back to the OS preference on first
// visit.

export type Theme = 'dark' | 'light'
const STORAGE_KEY = 'kolman-theme'
export const THEME_EVENT = 'theme:update'

function readStored(): Theme | null {
  if (typeof window === 'undefined') return null
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light' || v === 'dark') return v
  } catch { /* ignore */ }
  return null
}

function osPreference(): Theme {
  if (typeof window === 'undefined') return 'dark'
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function getTheme(): Theme {
  return readStored() ?? osPreference()
}

export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
}

export function setTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* ignore */ }
  applyTheme(theme)
  window.dispatchEvent(new Event(THEME_EVENT))
}

export function toggleTheme() {
  setTheme(getTheme() === 'light' ? 'dark' : 'light')
}

// Eager init: as early as possible to avoid a flash of wrong theme on
// first paint. Called from main.tsx.
export function initTheme() {
  applyTheme(getTheme())
}
