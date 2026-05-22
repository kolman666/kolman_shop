import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './i18n'
import { initTheme } from './lib/theme'

// Apply the saved/OS theme before React mounts so the very first paint
// already has the right colour palette — otherwise users see a flash of
// the default dark theme before the toggle resolves.
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
