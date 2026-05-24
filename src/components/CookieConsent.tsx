// Bottom-sheet cookie consent. Two states: "не решено" → banner visible;
// "accepted | declined" → hidden forever (decision persisted to localStorage).
//
// The buttons have a custom hover: ghost-outline at rest, on hover a coloured
// wave rises from the bottom — implemented with a pseudo-element whose
// transform-origin sits at the bottom edge.

import { useEffect, useState } from 'react'

const KEY = 'kolman-cookie-consent'
export const COOKIE_CONSENT_EVENT = 'cookie-consent:update'

export type ConsentState = 'accepted' | 'declined' | null

export function getConsent(): ConsentState {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'accepted' || v === 'declined') return v
    return null
  } catch { return null }
}

export function setConsent(state: 'accepted' | 'declined') {
  try { localStorage.setItem(KEY, state) } catch { /* ignore */ }
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT))
}

export default function CookieConsent() {
  // Start hidden — show only after we've checked localStorage AND given the
  // page a beat to paint. Avoids the banner flashing on top of skeletons.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const decided = getConsent() !== null
    if (decided) return
    const t = window.setTimeout(() => setVisible(true), 600)
    return () => window.clearTimeout(t)
  }, [])

  if (!visible) return null

  function decide(state: 'accepted' | 'declined') {
    setConsent(state)
    setVisible(false)
  }

  return (
    <div className="cookie-consent" role="dialog" aria-label="cookies">
      <div className="cookie-consent__panel">
        <div className="cookie-consent__text">
          <div>
            <p className="cookie-consent__title">мы используем cookies</p>
            <p className="cookie-consent__sub">
              Чтобы запоминать корзину, избранное и сохранять язык. Никаких трекеров для рекламы.
              {' '}
              <a href="/privacy" className="cookie-consent__link">подробнее</a>
            </p>
          </div>
        </div>
        <div className="cookie-consent__buttons">
          {/* Real DOM `<span class="cookie-btn__fill">` instead of a ::before
            * pseudo-element. Chrome on Windows had a long-standing bug where
            * pseudo-elements inside a backdrop-filter ancestor (`.cookie-
            * consent__panel`) wouldn't repaint on hover — the fill would
            * appear instantly at the end state. Real DOM children get their
            * own paint records and animate cleanly. */}
          <button
            type="button"
            className="cookie-btn cookie-btn--decline"
            onClick={() => decide('declined')}
          >
            <span className="cookie-btn__fill" aria-hidden="true" />
            <span className="cookie-btn__label">отклонить</span>
          </button>
          <button
            type="button"
            className="cookie-btn cookie-btn--accept"
            onClick={() => decide('accepted')}
          >
            <span className="cookie-btn__fill" aria-hidden="true" />
            <span className="cookie-btn__label">принять</span>
          </button>
        </div>
      </div>
    </div>
  )
}
