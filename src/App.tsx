import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Link, Route, Routes, useNavigate } from 'react-router-dom'
import './App.css'
import { useProducts } from './hooks/useProducts'
import SiteChrome from './components/SiteChrome'
import CartDrawer from './components/CartDrawer'
import BrandSpotlight from './components/BrandSpotlight'
import BloggersBlock from './components/BloggersBlock'
import AboutPage from './pages/AboutPage'
import AdminPage from './pages/AdminPage'
import CatalogPage from './pages/CatalogPage'
import ProductPage from './pages/ProductPage'
import SupportPage from './pages/SupportPage'
import { getCartCount } from './lib/cart'

type SlideText = {
  tag: string
  title: string
  subtitle: string
  accent: string
}

type PerkText = {
  title: string
  desc: string
}

type Perk = PerkText & {
  icon: ReactNode
}

type Category = {
  title: string
  image: string
}

type FeaturedProduct = {
  id: number
  slug: string
  title: string
  subtitle: string
  tag: string
  price: string
  specs: string[]
  image: string
}

const slideImages = [
  'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80',
  'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80',
  'https://images.unsplash.com/photo-1563297007-0686b7003af7?w=800&q=80',
]

const perkIcons = [
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 5v3h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
]

const categoryImages = [
  'https://polzarium.ru/content/images/2025/05/0-7.jpg',
  'https://ae01.alicdn.com/kf/Sdf5307d2047f4386b59dde83ff7df080r.png',
  'https://iqunix.com/cdn/shop/files/07_ef9ac2e6-4b41-471b-af02-4b537819110b.jpg?v=1765951802&width=1946',
  'https://i.ytimg.com/vi/AbOziOlBiMk/maxresdefault.jpg',
  'https://www.deltamechanics.ru/pictures/product/big/20100_big.jpg',
  'https://fbi.cults3d.com/uploaders/14107503/illustration-file/1080cada-90f7-4eef-a8fe-a112bfde6460/cyberpunk_edgerunners_keycaps_04.jpg',
]

const brandLogos = [
  {
    name: 'WLMOUSE',
    svg: (
      <svg viewBox="0 0 130 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="WLMOUSE">
        <rect x="2" y="5" width="14" height="22" rx="7" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="9" y1="5" x2="9" y2="16" stroke="currentColor" strokeWidth="1.5"/>
        <text x="24" y="26" className="brand-svg__text">WLMOUSE</text>
      </svg>
    ),
  },
  {
    name: 'ATTACK SHARK',
    svg: (
      <svg viewBox="0 0 200 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="ATTACK SHARK">
        <path d="M2 34 L10 6 L14 34" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <line x1="0" y1="34" x2="20" y2="34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <text x="28" y="26" className="brand-svg__text">ATTACK SHARK</text>
      </svg>
    ),
  },
  {
    name: 'CIDOO',
    svg: (
      <svg viewBox="0 0 105 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="CIDOO">
        <circle cx="10" cy="20" r="9" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="10" cy="20" r="3" fill="currentColor"/>
        <text x="26" y="26" className="brand-svg__text">CIDOO</text>
      </svg>
    ),
  },
  {
    name: 'AULA',
    svg: (
      <svg viewBox="0 0 90 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="AULA">
        <path d="M12 4 L6 21 L11 21 L8 36 L16 15 L11 15 Z" fill="currentColor"/>
        <text x="24" y="26" className="brand-svg__text">AULA</text>
      </svg>
    ),
  },
  {
    name: 'EPOMAKER',
    svg: (
      <svg viewBox="0 0 150 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="EPOMAKER">
        <rect x="1" y="8" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="4" y="22" width="12" height="5" rx="2.5" stroke="currentColor" strokeWidth="1.5"/>
        <text x="27" y="26" className="brand-svg__text">EPOMAKER</text>
      </svg>
    ),
  },
  {
    name: 'IQUNIX',
    svg: (
      <svg viewBox="0 0 125 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="IQUNIX">
        <polyline points="2,12 11,20 2,28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <line x1="14" y1="28" x2="22" y2="28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <text x="30" y="26" className="brand-svg__text">IQUNIX</text>
      </svg>
    ),
  },
  {
    name: 'PULSAR',
    svg: (
      <svg viewBox="0 0 125 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="PULSAR">
        <polyline points="0,20 4,20 7,10 10,30 13,20 17,20 20,13 23,20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <text x="30" y="26" className="brand-svg__text">PULSAR</text>
      </svg>
    ),
  },
  {
    name: 'WOOTING',
    svg: (
      <svg viewBox="0 0 135 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="WOOTING">
        <circle cx="11" cy="20" r="9" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="11" y1="11" x2="11" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="11" y1="20" x2="11" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <text x="27" y="26" className="brand-svg__text">WOOTING</text>
      </svg>
    ),
  },
  {
    name: 'G-WOLVES',
    svg: (
      <svg viewBox="0 0 148 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="G-WOLVES">
        <polyline points="1,8 5,28 10,16 15,28 19,8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
        <text x="27" y="26" className="brand-svg__text">G-WOLVES</text>
      </svg>
    ),
  },
  {
    name: 'LAMZU',
    svg: (
      <svg viewBox="0 0 102 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="LAMZU">
        <path d="M4 8 L4 30 L16 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="16" cy="14" r="2.5" fill="currentColor"/>
        <text x="24" y="26" className="brand-svg__text">LAMZU</text>
      </svg>
    ),
  },
]

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


function HomePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [cartCount, setCartCount] = useState(0)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [isBurgerOpen, setIsBurgerOpen] = useState(false)
  const { products } = useProducts()

  const slides = (t('slides', { returnObjects: true }) as SlideText[]).map((slide, index) => ({
    ...slide,
    img: slideImages[index],
  }))
  const navLinks = t('navLinks', { returnObjects: true }) as string[]
  const topLinks = t('topLinks', { returnObjects: true }) as string[]
  const footerNavigation = t('footerNavigation', { returnObjects: true }) as string[]
  const footerServices = t('footerServices', { returnObjects: true }) as string[]
  const footerProducts = t('footerProducts', { returnObjects: true }) as string[]
  const perks = (t('perks', { returnObjects: true }) as PerkText[]).map((perk, index) => ({
    ...perk,
    icon: perkIcons[index],
  })) as Perk[]
  const categories = (t('categories', { returnObjects: true }) as string[]).map((title, index) => ({
    title,
    image: categoryImages[index],
  })) as Category[]
  const featuredProducts = products
    .filter((product) => product.isFeatured)
    .slice(0, 2)
    .map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.titleDirect ?? t(product.titleKey),
      subtitle: product.descriptionDirect ?? t(product.descriptionKey),
      price: `${product.price} RUB`,
      image: product.image,
      tag: product.tagKey ? t(product.tagKey) : '',
      specs: product.specs ?? [],
    })) as FeaturedProduct[]

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, 4500)

    return () => window.clearInterval(timer)
  }, [slides.length])

  useEffect(() => {
    if (current >= slides.length) {
      setCurrent(0)
    }
  }, [current, slides.length])

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

  const slide = slides[current]

  const handleLanguageChange = (language: 'en' | 'ru') => {
    void i18n.changeLanguage(language)
    localStorage.setItem('language', language)
  }
  
  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const q = searchValue.trim()
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog')
  }

  const topLinkTargets = ['/about', '/catalog', '/support', '/catalog', '/catalog?featured=1']
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
  const homepageCategoryTargets = [
    'products.categories.mice',
    'products.categories.mousepads',
    'products.categories.keyboards',
    'products.categories.headsets',
    'products.categories.glides',
    'products.categories.accessories',
  ]

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
              onChange={(event) => setSearchValue(event.target.value)}
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
              return (
              <Link
                key={link}
                to={href}
                className="nav-link"
              >
                {link}
              </Link>
              )
            })}
          </div>
        </nav>
      </header>

      <main className="container page-content">
        <section className="hero-grid">
          <div className="hero-card">
            <div className="hero-card__image" style={{ backgroundImage: `url(${slide.img})` }} />
            <div className="hero-card__overlay" />
            <div className="hero-card__accent" />

            <div className="hero-card__content">
              <div key={current} className="hero-card__copy">
                <span className="hero-tag">{slide.tag}</span>
                <h1 className="hero-title">{slide.title}</h1>
                <p className="hero-subtitle">{slide.subtitle}</p>
                <p className="hero-accent-text">{slide.accent}</p>

                <div className="hero-actions">
                  <Link to="/catalog" className="cta-btn">
                    {t('ui.shopNow')}
                  </Link>
                  <button type="button" className="ghost-btn">
                    {t('ui.learnMore')}
                  </button>
                </div>
              </div>

              <div className="hero-dots" aria-label="slides navigation">
                {slides.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    className={`dot ${index === current ? 'active' : ''}`}
                    onClick={() => setCurrent(index)}
                    aria-label={`open slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            <div className="hero-arrows">
              <button
                type="button"
                className="slide-btn"
                onClick={() => setCurrent((prev) => (prev - 1 + slides.length) % slides.length)}
                aria-label="previous slide"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                className="slide-btn slide-btn--accent"
                onClick={() => setCurrent((prev) => (prev + 1) % slides.length)}
                aria-label="next slide"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          <aside className="side-panel">
            <Link to="/catalog" className="promo-card promo-card--accent">
              <svg className="promo-card__shape" width="180" height="180" viewBox="0 0 180 180" aria-hidden="true">
                <rect x="60" y="-30" width="120" height="120" rx="30" fill="#fff" transform="rotate(20 90 90)" />
                <rect x="90" y="40" width="100" height="100" rx="24" fill="#fff" transform="rotate(10 90 90)" />
              </svg>
              <p className="promo-label">{t('ui.readyToGearUp')}</p>
              <h2 className="promo-title">{t('ui.startShopping')}</h2>
              <span className="promo-arrow" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            </Link>

            <Link to="/catalog" className="promo-card promo-card--catalog">
              <div className="catalog-status">
                <span className="catalog-status__dot" />
                <span>{t('ui.fullCatalog')}</span>
              </div>
              <p className="catalog-text">{t('ui.catalogText')}</p>
            </Link>
          </aside>
        </section>

        <section className="perks-grid">
          {perks.map((perk) => (
            <article key={perk.title} className="perk-card">
              <div className="perk-card__icon">{perk.icon}</div>
              <div>
                <h3 className="perk-card__title">{perk.title}</h3>
                <p className="perk-card__text">{perk.desc}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="showcase-section" aria-labelledby="showcase-title">
          <div className="section-heading">
            <div>
              <p className="section-kicker">{t('ui.catalogHighlights')}</p>
              <h2 id="showcase-title" className="section-title">{t('ui.categoriesTitle')}</h2>
            </div>
            <p className="section-note">{t('ui.categoriesNote')}</p>
          </div>

          <div className="category-grid">
            {categories.map((category, index) => (
              <Link
                key={category.title}
                to={`/catalog?category=${encodeURIComponent(homepageCategoryTargets[index] ?? 'products.categories.mice')}`}
                className="category-card"
              >
                <div className="category-card__top">
                  <h3 className="category-card__title">{category.title}</h3>
                  <span className="category-card__arrow" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                </div>
                <div className="category-card__image" style={{ backgroundImage: `url(${category.image})` }} />
              </Link>
            ))}
          </div>

          <div className="featured-products">
            {featuredProducts.map((product) => (
              <article key={product.title} className="featured-card">
                <Link className="featured-card__cover" to={`/product/${product.slug}`} aria-label={product.title} />
                <div className="featured-card__media" style={{ backgroundImage: `url(${product.image})` }} />
                <div className="featured-card__overlay" />

                <div className="featured-card__content">
                  <span className="featured-card__tag">{product.tag}</span>
                  <h3 className="featured-card__title">{product.title}</h3>
                  <p className="featured-card__subtitle">{product.subtitle}</p>

                  <div className="featured-card__specs">
                    {product.specs.map((spec) => (
                      <span key={spec} className="featured-card__spec">
                        {spec}
                      </span>
                    ))}
                  </div>

                  <div className="featured-card__footer">
                    <strong className="featured-card__price">{product.price}</strong>
                    <span className="featured-card__button">
                      {t('ui.viewDetails')}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="brands-section" aria-labelledby="brands-title">
          <div className="brands-section__head">
            <div>
              <p className="brands-section__kicker">{t('ui.brandsKicker')}</p>
              <h2 id="brands-title" className="brands-section__title">{t('ui.brandsTitle')}</h2>
            </div>
            <p className="brands-section__note">{t('ui.brandsNote')}</p>
          </div>

          <div className="brands-strip brands-strip--fullbleed">
            <div className="marquee-wrap">
              <div className="marquee-track">
                {[...brandLogos, ...brandLogos].map((brand, i) => (
                  <div key={`${brand.name}-${i}`} className="marquee-item">
                    {brand.svg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <BrandSpotlight
        products={products}
        brandSlug="wlmouse"
        brandLabel="wlmouse"
        tagline="топовая периферия для серьёзных игроков — лёгкие мыши, точные коврики, быстрые клавиатуры"
        bannerImage="https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=1400&q=80"
      />

      <BloggersBlock products={products} />

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
          <Link to="/" className="footer-policy">
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

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/about"
          element={
            <SiteChrome>
              <AboutPage />
            </SiteChrome>
          }
        />
        <Route
          path="/support"
          element={
            <SiteChrome>
              <SupportPage />
            </SiteChrome>
          }
        />
        <Route
          path="/catalog"
          element={
            <SiteChrome>
              <CatalogPage />
            </SiteChrome>
          }
        />
        <Route
          path="/product/:slug"
          element={
            <SiteChrome>
              <ProductPage />
            </SiteChrome>
          }
        />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  )
}
