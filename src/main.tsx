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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
