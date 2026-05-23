import { lazy, Suspense, useEffect, useState, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { useProducts } from './hooks/useProducts'
import { useCustomerChatNotifications } from './hooks/useCustomerChatNotifications'
import { usePresenceHeartbeat } from './hooks/usePresenceHeartbeat'
import SiteChrome from './components/SiteChrome'
import CartDrawer from './components/CartDrawer'
import BrandSpotlight from './components/BrandSpotlight'
import MobileBottomNav from './components/MobileBottomNav'
import CompareBar from './components/CompareBar'
import BrandTicker from './components/BrandTicker'
import ShareCartImportToast from './components/ShareCartImportToast'
import CookieConsent from './components/CookieConsent'
import CartShareListener from './components/CartShareListener'
import BloggersBlock from './components/BloggersBlock'
import NewsBlock from './components/NewsBlock'
import AuthModal from './components/AuthModal'
import ProductRecommendations from './components/ProductRecommendations'
import { AUTH_EVENT, getUser, refreshUser, type User } from './lib/auth'
// Heavy routes are code-split so the home page doesn't ship them on first paint.
// Each sits behind <Suspense> in the Routes block below.
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
import { fetchSiteContent, fetchSiteContentLocalized } from './lib/siteContent'
import { safeBackgroundImage } from './lib/safeUrl'
import { FOOTER_NAV_ROUTES, FOOTER_SERVICE_ROUTES } from './lib/footerLinks'
import { markChatNotificationsRead } from './lib/chatNotifications'
import AboutPage from './pages/AboutPage'
// Admin is a big chunk (~250kb) and only relevant for the shop owner. Code-split
// it so first-paint for shoppers doesn't pull it in.
const AdminPage = lazy(() => import('./pages/AdminPage'))
const CatalogPage = lazy(() => import('./pages/CatalogPage'))
const ProductPage = lazy(() => import('./pages/ProductPage'))
import SupportPage from './pages/SupportPage'
import PartnershipPage from './pages/PartnershipPage'
import HelpChoosePage from './pages/HelpChoosePage'
import DeliveryPage from './pages/DeliveryPage'
import ModdingPage from './pages/ModdingPage'
import NewsArticlePage from './pages/NewsArticlePage'
import NewsArchivePage from './pages/NewsArchivePage'
import BrandPage from './pages/BrandPage'
const UsedMarketPage = lazy(() => import('./pages/UsedMarketPage'))
const ComparePage = lazy(() => import('./pages/ComparePage'))
import NotFoundPage from './pages/NotFoundPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import { getCartCount } from './lib/cart'
import SearchDropdown, { type SearchSection } from './components/SearchDropdown'

type SlideText = {
  tag: string
  title: string
  subtitle: string
  accent: string
  detailsUrl?: string
}

type PerkText = {
  title: string
  desc: string
}

type Perk = PerkText & {
  icon: ReactNode
}

type HomepageBrandSpotlight = {
  brandSlug: string
  brandLabel: string
  bannerImage: string
  bannerUrl?: string
  buttonText?: string
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
    <svg key="shield" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  (
    <svg key="delivery" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 5v3h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  (
    <svg key="star" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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

// The old `marqueeBrandLogos` (manual duplication for seamless loop) is no
// longer needed — BrandTicker renders the brands twice internally.

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
      <circle className="avito-dot avito-dot--green" cx="123" cy="256.7" r="122.6" />
      <circle className="avito-dot avito-dot--red" cx="335.6" cy="289.7" r="74.1" />
      <circle className="avito-dot avito-dot--purple" cx="146.4" cy="72.3" r="45.8" />
      <circle className="avito-dot avito-dot--blue" cx="306.8" cy="100.1" r="99.6" />
    </svg>
  )
}


function HomePage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  // Pauses the auto-advance while the cursor is over the hero. Combined
  // with the `current` dep in the auto-advance effect, this also gives us
  // the "reset countdown on manual nav" behaviour for free — any click on
  // a dot or arrow bumps `current`, the effect re-runs, the old timer is
  // cleared and a fresh 4.5s starts.
  const [heroHovered, setHeroHovered] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [isBurgerOpen, setIsBurgerOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [popularSections, setPopularSections] = useState<SearchSection[]>([])
  const [authOpen, setAuthOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(() => getUser())
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const [dbSlides, setDbSlides] = useState<Array<{ tag: string; title: string; subtitle: string; accent: string; img: string; detailsUrl?: string }> | null>(null)
  const [dbCategories, setDbCategories] = useState<Array<{ catalogKey: string; title: string; image: string }> | null>(null)
  const [dbPerks, setDbPerks] = useState<Array<{ title: string; desc: string }> | null>(null)
  const [dbBrandLogos, setDbBrandLogos] = useState<Array<{ name: string; slug?: string; image: string; url?: string }> | null>(null)
  const [dbBrandSpotlight, setDbBrandSpotlight] = useState<HomepageBrandSpotlight | null>(null)
  const { products } = useProducts()
  const chatNotifications = useCustomerChatNotifications(currentUser?.email)
  // Ping /api/auth?action=heartbeat while a logged-in user has the site open
  // so admin can see them as online + show last-seen in the chat sidebar.
  usePresenceHeartbeat(Boolean(currentUser))

  useEffect(() => {
    const lng = i18n.language.startsWith('en') ? 'en' : 'ru'
    fetchSiteContentLocalized<Array<{ tag: string; title: string; subtitle: string; accent: string; image: string; detailsUrl?: string }>>('hero_slides', lng).then((result) => {
      if (!result.error && result.data && result.data.length > 0) {
        setDbSlides(result.data.map((s) => ({ tag: s.tag, title: s.title, subtitle: s.subtitle, accent: s.accent, img: s.image, detailsUrl: s.detailsUrl })))
      }
    })
    fetchSiteContentLocalized<Array<{ catalogKey: string; title: string; image: string }>>('homepage_categories', lng).then((result) => {
      if (!result.error && result.data && result.data.length > 0) setDbCategories(result.data)
    })
    fetchSiteContentLocalized<Array<{ title: string; desc: string }>>('homepage_perks', lng).then((result) => {
      if (!result.error && result.data && result.data.length > 0) setDbPerks(result.data)
    })
    fetchSiteContent<SearchSection[]>('search_popular_sections').then((result) => {
      if (!result.error && result.data && result.data.length > 0) setPopularSections(result.data)
    })
    fetchSiteContent<Array<{ name: string; slug?: string; image: string; url?: string }>>('brand_logos').then((result) => {
      if (!result.error && result.data && result.data.length > 0) setDbBrandLogos(result.data)
    })
    fetchSiteContent<HomepageBrandSpotlight>('homepage_brand_spotlight').then((result) => {
      if (!result.error && result.data && result.data.brandSlug) setDbBrandSpotlight(result.data)
    })
  }, [i18n.language])

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
  const navHrefOverrides: Record<number, string> = {
    9: '/modding',
    10: '/used',
  }
  // Indexes that should render with a red "marketplace" pill instead of the
  // plain nav-link styling so customers can't miss it.
  const navHighlightIndexes = new Set<number>([10])
  const homepageCategoryTargets = [
    'products.categories.mice',
    'products.categories.mousepads',
    'products.categories.keyboards',
    'products.categories.headsets',
    'products.categories.glides',
    'products.categories.accessories',
  ]

  const i18nSlides = (t('slides', { returnObjects: true }) as SlideText[]).map((slide, index) => ({
    ...slide,
    img: slideImages[index] ?? '',
  }))
  const slides = dbSlides ?? i18nSlides

  const i18nCategories = (t('categories', { returnObjects: true }) as string[]).map((title, index) => ({
    catalogKey: homepageCategoryTargets[index] ?? '',
    title,
    image: categoryImages[index] ?? '',
  }))
  const activeCategories = dbCategories ?? i18nCategories

  const i18nPerksBase = t('perks', { returnObjects: true }) as PerkText[]
  const activePerks = (dbPerks ?? i18nPerksBase).map((perk, index) => ({
    ...perk,
    icon: perkIcons[index],
  })) as Perk[]
  const navLinks = t('navLinks', { returnObjects: true }) as string[]
  const topLinks = t('topLinks', { returnObjects: true }) as string[]
  const footerNavigation = t('footerNavigation', { returnObjects: true }) as string[]
  const footerServices = t('footerServices', { returnObjects: true }) as string[]
  const footerProducts = t('footerProducts', { returnObjects: true }) as string[]
  // perks and categories now come from DB override (activePerks / activeCategories below)

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
    if (slides.length <= 1) return
    if (heroHovered) return
    const timer = window.setTimeout(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, 4500)
    return () => window.clearTimeout(timer)
  }, [slides.length, current, heroHovered])

  useEffect(() => {
    const syncCart = () => setCartCount(getCartCount())
    const openCart = () => setIsCartOpen(true)
    syncCart()
    window.addEventListener('cart:update', syncCart)
    window.addEventListener('storage', syncCart)
    window.addEventListener('cart:open', openCart)
    return () => {
      window.removeEventListener('cart:update', syncCart)
      window.removeEventListener('storage', syncCart)
      window.removeEventListener('cart:open', openCart)
    }
  }, [])

  useEffect(() => {
    const syncUser = () => setCurrentUser(getUser())
    window.addEventListener(AUTH_EVENT, syncUser)
    window.addEventListener('storage', syncUser)
    // Validate the cached token against the server on first paint — picks up
    // profile changes made from other devices and signs us out if the token
    // was revoked or expired.
    void refreshUser()
    return () => {
      window.removeEventListener(AUTH_EVENT, syncUser)
      window.removeEventListener('storage', syncUser)
    }
  }, [])

  const handleAccountClick = () => {
    if (currentUser) {
      markChatNotificationsRead()
      chatNotifications.clear()
      navigate('/profile')
    } else {
      setAuthOpen(true)
    }
  }

  const visibleSlideIndex = slides.length > 0 ? current % slides.length : 0
  const slide = slides[visibleSlideIndex]

  const handleLanguageChange = (language: 'en' | 'ru') => {
    void i18n.changeLanguage(language)
    localStorage.setItem('language', language)
  }
  
  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const q = searchValue.trim()
    navigate(q ? `/catalog?q=${encodeURIComponent(q)}` : '/catalog')
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

          <div ref={searchWrapRef} className="search-wrap">
            <form className="search" role="search" onSubmit={(e) => { setSearchOpen(false); handleSearchSubmit(e) }}>
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
                onFocus={() => setSearchOpen(true)}
              />
            </form>
            <SearchDropdown
              open={searchOpen}
              onClose={() => setSearchOpen(false)}
              hitProducts={products.filter((p) => p.isFeatured).slice(0, 4)}
              allProducts={products}
              query={searchValue}
              popularSections={popularSections}
              anchorRef={searchWrapRef}
            />
          </div>

          <div className="header-actions">
            {/* "блог" and "выбор блогеров" removed from header per request —
             * the blog is reachable via the news block on the home page and
             * the /news archive route. */}

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

            {/* ThemeToggle temporarily removed — light theme is being redone */}

            <button type="button" className="icon-button hide-on-mobile" aria-label="cart" onClick={() => setIsCartOpen(true)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <path d="M3 6h18" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
            </button>

            <button
              type="button"
              className="icon-button icon-button--avatar hide-on-mobile"
              aria-label="account"
              onClick={handleAccountClick}
              title={currentUser ? (currentUser.firstName || currentUser.name) : t('ui.auth.loginTitle')}
            >
              {currentUser?.photo ? (
                <img
                  src={currentUser.photo}
                  alt=""
                  className="icon-button__avatar"
                />
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
              {chatNotifications.unreadChats > 0 && (
                <span className="chat-site-badge">{chatNotifications.unreadChats}</span>
              )}
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
              const override = navHrefOverrides[index]
              const categoryKey = navCategoryTargets[index] ?? ''
              const href = override
                ?? (categoryKey ? `/catalog?category=${encodeURIComponent(categoryKey)}` : '/catalog')
              const highlight = navHighlightIndexes.has(index)
              return (
              <Link
                key={link}
                to={href}
                className={`nav-link ${highlight ? 'nav-link--pill' : ''}`.trim()}
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
          <div
            className="hero-card"
            onMouseEnter={() => setHeroHovered(true)}
            onMouseLeave={() => setHeroHovered(false)}
          >
            <div className="hero-card__image" style={(() => { const u = safeBackgroundImage(slide.img); return u ? { backgroundImage: `url("${u}")` } : undefined })()} />
            <div className="hero-card__overlay" />
            <div className="hero-card__accent" />

            <div className="hero-card__content">
              <div key={visibleSlideIndex} className="hero-card__copy">
                <span className="hero-tag">{slide.tag}</span>
                <h1 className="hero-title">{slide.title}</h1>
                <p className="hero-subtitle">{slide.subtitle}</p>
                <p className="hero-accent-text">{slide.accent}</p>
              </div>

              <div className="hero-dots" aria-label="slides navigation">
                {slides.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    className={`dot ${index === visibleSlideIndex ? 'active' : ''}`}
                    onClick={() => setCurrent(index)}
                    aria-label={`open slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            {/*
              Big full-height CTA panel on the right edge of the hero. Replaces
              the old inline button row + the "учше каталог" secondary link.
              The whole panel is one clickable target; the inner shimmer and
              arrow animate on idle + hover.
            */}
            <Link to="/catalog" className="hero-card__cta-panel" aria-label={t('ui.shopNow')}>
              <span className="hero-card__cta-shimmer" aria-hidden="true" />
              <span className="hero-card__cta-grid" aria-hidden="true" />
              <span className="hero-card__cta-inner">
                <span className="hero-card__cta-label">{t('ui.shopNow')}</span>
                <span className="hero-card__cta-arrow" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </span>
              </span>
            </Link>

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
          {activePerks.map((perk) => (
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
            {activeCategories.map((category) => (
              <Link
                key={category.catalogKey}
                to={category.catalogKey ? `/catalog?category=${encodeURIComponent(category.catalogKey)}` : '/catalog'}
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
                <div className="category-card__image" style={(() => { const u = safeBackgroundImage(category.image); return u ? { backgroundImage: `url("${u}")` } : undefined })()} />
              </Link>
            ))}
          </div>

          <div className="featured-products">
            {featuredProducts.map((product) => (
              <article key={product.title} className="featured-card">
                <Link className="featured-card__cover" to={`/product/${product.slug}`} aria-label={product.title} />
                <div className="featured-card__media" style={(() => { const u = safeBackgroundImage(product.image); return u ? { backgroundImage: `url("${u}")` } : undefined })()} />
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

      </main>

      <BrandSpotlight
        products={products}
        brandSlug={dbBrandSpotlight?.brandSlug ?? 'wlmouse'}
        brandLabel={dbBrandSpotlight?.brandLabel ?? 'wlmouse'}
        bannerImage={dbBrandSpotlight?.bannerImage ?? 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=1400&q=80'}
        bannerUrl={dbBrandSpotlight?.bannerUrl ?? '/brand/wlmouse'}
        bannerLabel={dbBrandSpotlight?.buttonText ?? 'перейти к бренду →'}
      />

      <section className="brands-section brands-section--standalone" aria-labelledby="brands-title">
        <div className="container brands-section__head">
          <div>
            <p className="brands-section__kicker">{t('ui.brandsKicker')}</p>
            <h2 id="brands-title" className="brands-section__title">{t('ui.brandsTitle')}</h2>
          </div>
          <p className="brands-section__note">{t('ui.brandsNote')}</p>
        </div>
        <div className="brands-strip brands-strip--fullbleed">
          <BrandTicker
            ariaLabel={t('ui.brandsTitle')}
            items={
              dbBrandLogos && dbBrandLogos.length > 0
                ? dbBrandLogos.map((brand) => {
                    const slug = brand.slug?.trim()
                    const target = (brand.url?.trim())
                      || (slug ? `/brand/${slug}` : `/catalog?brand=${encodeURIComponent(brand.name)}`)
                    return {
                      kind: 'image' as const,
                      name: brand.name,
                      image: brand.image || '',
                      url: target,
                      external: /^https?:\/\//i.test(target),
                    }
                  })
                : brandLogos.map((b) => ({
                    kind: 'svg' as const,
                    key: b.name,
                    node: b.svg,
                  }))
            }
          />
        </div>
      </section>

      <BloggersBlock products={products} />

      <NewsBlock />

      <ProductRecommendations products={products.filter((product) => !product.isUsed)} />

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

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <MobileBottomNav
        onCartClick={() => setIsCartOpen(true)}
        onProfileClick={handleAccountClick}
      />
      <CompareBar />
      <CookieConsent />
      <ShareCartImportToast />

      <div className={`chat-site-toast ${chatNotifications.toast ? 'chat-site-toast--visible' : ''}`}>
        <strong>{chatNotifications.toast?.title}</strong>
        <span>{chatNotifications.toast?.body}</span>
      </div>

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
                      <Link to={FOOTER_NAV_ROUTES[index] ?? '/'}>{item}</Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="footer-column">
                <h3 className="footer-title">{t('ui.services')}</h3>
                <ul className="footer-list">
                  {footerServices.map((item, index) => (
                    <li key={item}>
                      <Link to={FOOTER_SERVICE_ROUTES[index] ?? '/'}>{item}</Link>
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

function ScrollToTop() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, search])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <CartShareListener />
      {/* All non-home routes are lazy-loaded; share a single Suspense boundary
        * so we don't ship multiple loading spinners. */}
      <Suspense fallback={
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)', fontSize: 13 }}>
          загрузка…
        </div>
      }>
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
        <Route
          path="/partnership"
          element={<SiteChrome><PartnershipPage /></SiteChrome>}
        />
        <Route
          path="/help-choose"
          element={<SiteChrome><HelpChoosePage /></SiteChrome>}
        />
        <Route
          path="/delivery"
          element={<SiteChrome><DeliveryPage /></SiteChrome>}
        />
        <Route
          path="/modding"
          element={<SiteChrome><ModdingPage /></SiteChrome>}
        />
        <Route
          path="/news"
          element={<SiteChrome><NewsArchivePage /></SiteChrome>}
        />
        <Route
          path="/news/:id"
          element={<SiteChrome><NewsArticlePage /></SiteChrome>}
        />
        <Route
          path="/brand/:slug"
          element={<SiteChrome><BrandPage /></SiteChrome>}
        />
        <Route
          path="/used"
          element={<SiteChrome><UsedMarketPage /></SiteChrome>}
        />
        <Route
          path="/compare"
          element={<SiteChrome><ComparePage /></SiteChrome>}
        />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-dim)' }}>Loading admin…</div>}>
              <AdminPage />
            </Suspense>
          }
        />
        <Route
          path="/profile"
          element={
            <SiteChrome>
              <ProfilePage />
            </SiteChrome>
          }
        />
        <Route
          path="/privacy"
          element={
            <SiteChrome>
              <PrivacyPolicyPage />
            </SiteChrome>
          }
        />
        <Route
          path="*"
          element={
            <SiteChrome>
              <NotFoundPage />
            </SiteChrome>
          }
        />
      </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
