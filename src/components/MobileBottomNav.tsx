// Sticky bottom navigation for phones. Mirrors the four most-used top-bar
// destinations (home / catalog / cart / profile) so users on small screens
// don't have to open the burger menu for routine taps.
//
// Hidden ≥ 720px by CSS. Hidden in the admin panel (/admin*) because the
// admin UI is desktop-first and the bar would just cover content.

import { Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCartCount } from '../lib/cart'
import { AUTH_EVENT, getUser, type User } from '../lib/auth'

type Props = {
  onCartClick?: () => void
  onProfileClick?: () => void
}

export default function MobileBottomNav({ onCartClick, onProfileClick }: Props) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [cartCount, setCartCount] = useState(0)
  const [user, setUser] = useState<User | null>(() => getUser())

  useEffect(() => {
    const sync = () => setCartCount(getCartCount())
    sync()
    window.addEventListener('cart:update', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('cart:update', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    const sync = () => setUser(getUser())
    window.addEventListener(AUTH_EVENT, sync)
    return () => window.removeEventListener(AUTH_EVENT, sync)
  }, [])

  // Don't render inside the admin panel.
  if (pathname.startsWith('/admin')) return null

  const isActive = (re: RegExp) => re.test(pathname)

  return (
    <nav className="mobile-bottom-nav" aria-label={t('ui.nav.catalog')}>
      <Link to="/" className={`mobile-bottom-nav__item ${pathname === '/' ? 'mobile-bottom-nav__item--active' : ''}`.trim()}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 12L12 4l9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
        <span>{t('ui.nav.home')}</span>
      </Link>
      <Link to="/catalog" className={`mobile-bottom-nav__item ${isActive(/^\/(catalog|product|brand|used|modding)/) ? 'mobile-bottom-nav__item--active' : ''}`.trim()}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <span>{t('ui.nav.catalog')}</span>
      </Link>
      <button
        type="button"
        className="mobile-bottom-nav__item mobile-bottom-nav__item--cart"
        onClick={() => onCartClick?.()}
        aria-label={t('ui.nav.cart')}
      >
        <span className="mobile-bottom-nav__cart-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <path d="M3 6h18" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          {cartCount > 0 && <span className="mobile-bottom-nav__badge">{cartCount}</span>}
        </span>
        <span>{t('ui.nav.cart')}</span>
      </button>
      {user ? (
        <Link
          to="/profile"
          className={`mobile-bottom-nav__item ${pathname.startsWith('/profile') ? 'mobile-bottom-nav__item--active' : ''}`.trim()}
        >
          {user.photo
            ? <img src={user.photo} alt="" className="mobile-bottom-nav__avatar" />
            : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20a8 8 0 0116 0" />
              </svg>
            )}
          <span>{t('ui.nav.profile')}</span>
        </Link>
      ) : (
        <button
          type="button"
          className="mobile-bottom-nav__item"
          onClick={() => onProfileClick?.()}
          aria-label={t('ui.nav.profile')}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20a8 8 0 0116 0" />
          </svg>
          <span>{t('ui.nav.signIn')}</span>
        </button>
      )}
    </nav>
  )
}
