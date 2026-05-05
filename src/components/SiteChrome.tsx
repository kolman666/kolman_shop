import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import { getCartCount } from '../lib/cart'
import CartDrawer from './CartDrawer'

type SiteChromeProps = {
  children: ReactNode
}

type BrandLogoProps = {
  className?: string
}

function BrandLogo({ className = '' }: BrandLogoProps) {
  return (
    <Link to="/" className={`brand-logo ${className}`.trim()} aria-label="kolman shop logo">
      <span className="brand-logo__part brand-logo__part--accent">kolman</span>
      <span className="brand-logo__part">shop</span>
    </Link>
  )
}

function TelegramIcon() {
  return (
    <svg className="social-icon social-icon--telegram" viewBox="0 0 512 512" aria-hidden="true">
      <path d="M477 43.86 13.32 223.29a5.86 5.86 0 0 0-.8.38c-3.76 2.13-30 18.18 7 32.57l.38.14 110.41 35.67a6.08 6.08 0 0 0 5.09-.62L409.25 120.57a6 6 0 0 1 2.2-.83c3.81-.63 14.78-1.81 7.84 7-7.85 10-194.9 177.62-215.66 196.21a6.3 6.3 0 0 0-2.07 4.17l-9.06 108a7.08 7.08 0 0 0 2.83 5.67 6.88 6.88 0 0 0 8.17-.62l65.6-58.63a6.09 6.09 0 0 1 7.63-.39l114.45 83.1.37.25c2.77 1.71 32.69 19.12 41.33-19.76l79-375.65c.11-1.19 1.18-14.27-8.17-22-9.82-8.08-23.72-4-25.81-3.56A6 6 0 0 0 477 43.86Z" />
    </svg>
  )
}

function AvitoIcon() {
  return (
    <svg className="social-icon social-icon--avito" viewBox="0 0 410 380" aria-hidden="true">
      <path
        className="avito-dot avito-dot--green"
        d="M122.965 379.27C190.652 379.27 245.524 324.398 245.524 256.711C245.524 189.023 190.652 134.152 122.965 134.152C55.2778 134.152 0.40625 189.023 0.40625 256.711C0.40625 324.398 55.2778 379.27 122.965 379.27Z"
      />
      <path
        className="avito-dot avito-dot--red"
        d="M335.574 363.803C376.475 363.803 409.631 330.646 409.631 289.745C409.631 248.844 376.475 215.688 335.574 215.688C294.673 215.688 261.516 248.844 261.516 289.745C261.516 330.646 294.673 363.803 335.574 363.803Z"
      />
      <path
        className="avito-dot avito-dot--purple"
        d="M146.404 118.175C171.715 118.175 192.233 97.6569 192.233 72.3466C192.233 47.0363 171.715 26.5182 146.404 26.5182C121.094 26.5182 100.576 47.0363 100.576 72.3466C100.576 97.6569 121.094 118.175 146.404 118.175Z"
      />
      <path
        className="avito-dot avito-dot--blue"
        d="M306.803 199.696C361.835 199.696 406.448 155.083 406.448 100.051C406.448 45.0183 361.835 0.405762 306.803 0.405762C251.77 0.405762 207.158 45.0183 207.158 100.051C207.158 155.083 251.77 199.696 306.803 199.696Z"
      />
    </svg>
  )
}

export default function SiteChrome({ children }: SiteChromeProps) {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [cartCount, setCartCount] = useState(0)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [showCartToast, setShowCartToast] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [isBurgerOpen, setIsBurgerOpen] = useState(false)
  const { products: allProducts } = useProducts()

  useEffect(() => {
    if (location.pathname === '/catalog') {
      setSearchValue(new URLSearchParams(location.search).get('q') ?? '')
    } else {
      setSearchValue('')
    }
  }, [location.pathname, location.search])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = searchValue.trim()
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog')
  }

  const topLinks = t('topLinks', { returnObjects: true }) as string[]
  const navLinks = t('navLinks', { returnObjects: true }) as string[]
  const footerNavigation = t('footerNavigation', { returnObjects: true }) as string[]
  const footerServices = t('footerServices', { returnObjects: true }) as string[]
  const footerProducts = t('footerProducts', { returnObjects: true }) as string[]

  const handleLanguageChange = (language: 'en' | 'ru') => {
    void i18n.changeLanguage(language)
    localStorage.setItem('language', language)
  }

  useEffect(() => {
    const syncCart = () => setCartCount(getCartCount())
    syncCart()
    window.addEventListener('cart:update', syncCart)
    window.addEventListener('storage', syncCart)
    return () => {
      window.removeEventListener('cart:update', syncCart)
      window.removeEventListener('storage', syncCart)
    }
  }, [])

  useEffect(() => {
    let toastTimer: number | null = null
    const onItemAdded = () => {
      setShowCartToast(true)
      if (toastTimer) window.clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => setShowCartToast(false), 1400)
    }
    window.addEventListener('cart:item-added', onItemAdded as EventListener)
    return () => {
      window.removeEventListener('cart:item-added', onItemAdded as EventListener)
      if (toastTimer) window.clearTimeout(toastTimer)
    }
  }, [])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname, location.search])

  const topLinkTargets = ['/about', '/partnership', '/support', '/help-choose', '/delivery']
  const navCategoryTargets = [
    'products.categories.mice',
    'products.categories.mousepads',
    'products.categories.keyboards',
    '',
    '',
    'products.categories.glides',
    'products.categories.headsets',
    '',
    'products.categories.accessories',
    '',
  ]

  const pathParts = location.pathname.split('/').filter(Boolean)
  const breadcrumbs: Array<{ to?: string; label: string }> = [{ to: '/', label: t('ui.breadcrumbs.home') }]

  if (pathParts[0] === 'about') breadcrumbs.push({ label: 'о нас' })
  if (pathParts[0] === 'support') breadcrumbs.push({ label: 'поддержка' })
  if (pathParts[0] === 'partnership') breadcrumbs.push({ label: 'партнерство' })
  if (pathParts[0] === 'help-choose') breadcrumbs.push({ label: 'помочь с выбором' })
  if (pathParts[0] === 'delivery') breadcrumbs.push({ label: 'доставка и оплата' })
  if (pathParts[0] === 'privacy') breadcrumbs.push({ label: 'политика конфиденциальности' })

  if (pathParts[0] === 'catalog') {
    breadcrumbs.push({ label: t('ui.breadcrumbs.catalog') })
  }

  if (pathParts[0] === 'product') {
    breadcrumbs.push({ to: '/catalog', label: t('ui.breadcrumbs.catalog') })
    const productKey = decodeURIComponent(pathParts[1] ?? '')
    const product = allProducts.find((item) => item.slug === productKey) ?? allProducts.find((item) => String(item.id) === productKey)
    breadcrumbs.push({ label: product ? (product.titleDirect ?? t(product.titleKey)) : t('ui.breadcrumbs.product') })
  }

  return (
    <div className="app-shell">
      <div className="top-bar">
        <div className="container top-bar__inner">
          {topLinks.map((link, index) => (
            <Link key={link} to={topLinkTargets[index] ?? '/catalog'} className="top-link">
              {link}
            </Link>
          ))}
        </div>
      </div>

      <header className="site-header">
        <div className="container header-main">
          <BrandLogo />

          <form className="search" role="search" onSubmit={handleSearchSubmit}>
            <button type="submit" className="search__icon-btn" aria-label="search">
              <svg className="search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
            <input
              className="search__input"
              placeholder={t('ui.searchPlaceholder')}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </form>

          <div className="header-actions">
            <button type="button" className="header-link">
              {t('ui.blog')}
            </button>
            <button type="button" className="header-link header-link--accent">
              {t('ui.mediaPicks')}
            </button>

            <div className="language-switch" aria-label={t('ui.language')}>
              <button
                type="button"
                className={`language-switch__button ${i18n.language.startsWith('en') ? 'active' : ''}`}
                onClick={() => handleLanguageChange('en')}
              >
                EN
              </button>
              <button
                type="button"
                className={`language-switch__button ${i18n.language.startsWith('ru') ? 'active' : ''}`}
                onClick={() => handleLanguageChange('ru')}
              >
                RU
              </button>
            </div>

            <button type="button" className="icon-button" aria-label="cart" onClick={() => setIsCartOpen(true)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>

            <button type="button" className="icon-button" aria-label="account">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>

            <button type="button" className="burger-btn" aria-label="menu" onClick={() => setIsBurgerOpen(true)}>
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="0" y1="1" x2="18" y2="1" />
                <line x1="0" y1="7" x2="18" y2="7" />
                <line x1="0" y1="13" x2="18" y2="13" />
              </svg>
            </button>
          </div>
        </div>

        <nav className="main-nav">
          <div className="container main-nav__inner">
            {navLinks.map((link, index) => {
              const categoryKey = navCategoryTargets[index] ?? ''
              const href = categoryKey ? `/catalog?category=${encodeURIComponent(categoryKey)}` : '/catalog'
              const isActive = categoryKey
                ? location.pathname === '/catalog' && new URLSearchParams(location.search).get('category') === categoryKey
                : false

              return (
                <Link
                key={link}
                to={href}
                className={`nav-link ${isActive ? 'active' : ''}`}
              >
                {link}
              </Link>
              )
            })}
          </div>
        </nav>

        <div className="container breadcrumbs">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="breadcrumbs__item">
              {crumb.to ? (
                <Link to={crumb.to} className="breadcrumbs__link">
                  {crumb.label}
                </Link>
              ) : (
                <span className="breadcrumbs__current">{crumb.label}</span>
              )}
              {index < breadcrumbs.length - 1 && <span className="breadcrumbs__sep">/</span>}
            </span>
          ))}
        </div>
      </header>

      {children}

      <div className={`cart-toast ${showCartToast ? 'cart-toast--visible' : ''}`}>
        Добавлено в корзину
      </div>

      {isBurgerOpen && (
        <div className="burger-overlay" onClick={() => setIsBurgerOpen(false)} />
      )}
      <div className={`burger-panel ${isBurgerOpen ? 'burger-panel--open' : ''}`}>
        <div className="burger-panel__head">
          <BrandLogo />
          <button type="button" className="burger-panel__close" onClick={() => setIsBurgerOpen(false)} aria-label="close menu">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13" />
              <line x1="13" y1="1" x2="1" y2="13" />
            </svg>
          </button>
        </div>

        <div className="burger-panel__search">
          <form role="search" onSubmit={handleSearchSubmit}>
            <div style={{ position: 'relative' }}>
              <button type="submit" className="search__icon-btn" aria-label="search">
                <svg className="search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              </button>
              <input
                className="search__input"
                placeholder={t('ui.searchPlaceholder')}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
          </form>
        </div>

        <nav className="burger-panel__links">
          {topLinks.map((link, index) => (
            <Link
              key={link}
              to={topLinkTargets[index] ?? '/catalog'}
              className="burger-panel__link"
              onClick={() => setIsBurgerOpen(false)}
            >
              {link}
            </Link>
          ))}
        </nav>

        <div className="burger-panel__footer">
          <div className="language-switch" aria-label={t('ui.language')}>
            <button
              type="button"
              className={`language-switch__button ${i18n.language.startsWith('en') ? 'active' : ''}`}
              onClick={() => handleLanguageChange('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={`language-switch__button ${i18n.language.startsWith('ru') ? 'active' : ''}`}
              onClick={() => handleLanguageChange('ru')}
            >
              RU
            </button>
          </div>
        </div>
      </div>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />

      <footer className="site-footer">
        <div className="container footer-grid">
          <section className="footer-card footer-card--contact">
            <BrandLogo className="brand-logo--footer" />

            <div className="footer-contact-block">
              <h3 className="footer-title">{t('ui.alwaysAvailable')}</h3>
              <ul className="footer-contact-list">
                <li>{t('ui.address')}</li>
                <li>{t('ui.workHours')}</li>
                <li>hello@kolman.shop</li>
              </ul>
            </div>

            <div className="footer-socials">
              <a href="https://t.me/kolman_shop_bot" target="_blank" className="footer-social" aria-label="telegram" rel="noopener noreferrer">
                <TelegramIcon />
              </a>
              <a href="https://www.avito.ru/brands/ff6ecb53876080972365fc0b263271ac" target="_blank" className="footer-social" aria-label="avito" rel="noopener noreferrer">
                <AvitoIcon />
              </a>
            </div>
          </section>

          <section className="footer-card footer-card--links">
            <div className="footer-columns">
              <div className="footer-column">
                <h3 className="footer-title">{t('ui.navigation')}</h3>
                <ul className="footer-list">
                  {footerNavigation.map((item, index) => (
                    <li key={item}>
                      <Link to={index === 0 ? '/about' : '/'}>{item}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="footer-column">
                <h3 className="footer-title">{t('ui.services')}</h3>
                <ul className="footer-list">
                  {footerServices.map((item) => (
                    <li key={item}>
                      <Link to="/">{item}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="footer-column">
                <h3 className="footer-title">{t('ui.products')}</h3>
                <ul className="footer-list">
                  {footerProducts.map((item) => (
                    <li key={item}>
                      <Link to="/catalog">{item}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        <div className="container footer-bottom">
          <Link to="/privacy" className="footer-policy">
            {t('ui.privacyPolicy')}
          </Link>
          <p className="footer-credit">
            {t('ui.developedBy')} <span className="footer-credit__brand">kolman</span>
          </p>
          <span className="footer-year">(c) 2026 xD rofl sixseven</span>
        </div>
      </footer>
    </div>
  )
}
