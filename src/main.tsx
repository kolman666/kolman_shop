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

// `?share-cart=<id:qty,...>` — when a friend pastes the URL we merge those
// items into the local cart before React renders. The cart-update event
// dispatched by writeCart is what makes the cart badge re-count.
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
