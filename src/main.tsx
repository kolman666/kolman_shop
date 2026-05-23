import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './i18n'
import { initTheme } from './lib/theme'
import { importCartFromUrl } from './lib/cart'

// Apply the saved/OS theme before React mounts so the very first paint
// already has the right colour palette — otherwise users see a flash of
// the default dark theme before the toggle resolves.
initTheme()

// Pick up `?share-cart=...` URLs the moment we boot. importCartFromUrl
// dispatches `cart:share-imported` synchronously inside the call. We
// register the listener FIRST so we capture the event into a
// `window.__pendingShareCart` slot — ShareCartImportToast reads it on
// its initial render.
window.addEventListener('cart:share-imported', (e) => {
  const detail = (e as CustomEvent<{ items: Record<string, number> }>).detail
  if (detail?.items) {
    ;(window as typeof window & { __pendingShareCart?: { items: Record<string, number> } })
      .__pendingShareCart = { items: detail.items }
  }
}, { once: true })
importCartFromUrl()

// Register the service worker (PWA install + offline caching of static
// assets). Registration is best-effort — failures are logged once but never
// block the app.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[sw] register failed', err)
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
