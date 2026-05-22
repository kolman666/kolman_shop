// TEMP: light theme is disabled while it gets redone from scratch. Everything
// here is forced to `dark`. The module is kept (rather than ripped out) so the
// upcoming redesign pass can re-enable switching without re-plumbing imports
// across the app — ThemeToggle still consumes THEME_EVENT, getTheme, etc.

export type Theme = 'dark' | 'light'
const STORAGE_KEY = 'kolman-theme'
export const THEME_EVENT = 'theme:update'

export function getTheme(): Theme {
  return 'dark'
}

export function applyTheme(_theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = 'dark'
}

export function setTheme(_theme: Theme) {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  applyTheme('dark')
  window.dispatchEvent(new Event(THEME_EVENT))
}

export function toggleTheme() {
  // no-op while light theme is disabled
  setTheme('dark')
}

// Eager init: wipes any previously stored `light` preference (so returning
// users don't see the broken light skin) and forces dark before React mounts.
export function initTheme() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  applyTheme('dark')
}
