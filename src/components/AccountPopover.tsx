import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { logout, type User } from '../lib/auth'
import { getFavoritesCount, FAVORITES_EVENT } from '../lib/favorites'
import { getCartCount } from '../lib/cart'

// ─── Two-column "account" dropdown inspired by dns-shop.ru ─────────────
// Clicking the header avatar opens this popover instead of jumping straight
// to /profile. Left column lists notification categories (orders, chat,
// favourites, etc.); right column is the user header + a menu of profile
// sections. Each menu item deep-links to `/profile?tab=<section>` so the
// ProfilePage can land the user on the right view.
//
// Triggered by `<button onClick={() => setOpen(true)}>` in App.tsx /
// SiteChrome.tsx — both pass `anchorRef` so we can position the popover
// just below the avatar.

type Props = {
  open: boolean
  user: User
  unreadChats: number
  /** The avatar button — used to compute popover offset under it. */
  anchorRef: React.RefObject<HTMLButtonElement | null>
  /** Called when the popover wants to close (click outside, ESC, nav). */
  onClose: () => void
  /** Called when the user clicks "Выйти" — caller decides where to navigate. */
  onLogout?: () => void
}

type NotificationItem = {
  key: string
  icon: ReactNode
  label: string
  hint: string
  count?: number
  href: string
  tone?: 'red' | 'orange' | 'blue' | 'green'
}

type MenuItem = {
  key: string
  label: string
  href: string
  badge?: number
}

export default function AccountPopover({ open, user, unreadChats, anchorRef, onClose, onLogout }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const popoverRef = useRef<HTMLDivElement>(null)
  // Local mirrors of cart / favourites counts so the popover updates
  // instantly when a user adds something while it's open.
  const [favCount, setFavCount] = useState(() => getFavoritesCount())
  const [cartCount, setCartCount] = useState(() => getCartCount())

  useEffect(() => {
    if (!open) return
    const sync = () => {
      setFavCount(getFavoritesCount())
      setCartCount(getCartCount())
    }
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    window.addEventListener('cart:update', sync)
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync)
      window.removeEventListener('cart:update', sync)
    }
  }, [open])

  // Close on click-outside and on Escape. We listen on `mousedown` instead
  // of `click` so the popover dismisses *before* React fires any unwanted
  // clicks underneath it (e.g. a stale catalog card).
  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node | null
      if (!target) return
      if (popoverRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorRef])

  // Lock body scroll on mobile so the bottom-sheet feels modal-like.
  // Desktop popover doesn't need this — page content remains scrollable.
  useEffect(() => {
    if (!open) return
    const isMobile = window.matchMedia('(max-width: 720px)').matches
    if (!isMobile) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const displayName = useMemo(() => {
    const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
    return full || user.name || user.email.split('@')[0]
  }, [user])

  // Notification cards — only render the ones with actual signal so an
  // empty account doesn't feel cluttered. Each has a tone for the icon
  // colour and a count badge when relevant.
  const notifications: NotificationItem[] = []

  if (unreadChats > 0) {
    notifications.push({
      key: 'chat',
      icon: <BubbleIcon />,
      label: 'Чат с поддержкой',
      hint: unreadChats === 1 ? 'новое сообщение' : `${unreadChats} новых сообщений`,
      count: unreadChats,
      href: '/profile?tab=chat',
      tone: 'red',
    })
  }
  notifications.push({
    key: 'orders',
    icon: <BoxIcon />,
    label: 'Заказы',
    hint: 'статусы и отслеживание',
    href: '/profile?tab=orders',
    tone: 'orange',
  })
  if (cartCount > 0 || favCount > 0) {
    notifications.push({
      key: 'cart-fav',
      icon: <HeartIcon />,
      label: 'Корзина и избранное',
      hint: [
        cartCount > 0 ? `${cartCount} в корзине` : null,
        favCount > 0 ? `${favCount} в избранном` : null,
      ].filter(Boolean).join(' · ') || 'пусто',
      count: cartCount + favCount,
      href: cartCount > 0 ? '/catalog' : '/profile?tab=favorites',
      tone: 'red',
    })
  }
  notifications.push({
    key: 'inquiries',
    icon: <ChatBubbleIcon />,
    label: 'Заявки',
    hint: 'ваши обращения',
    href: '/profile?tab=inquiries',
    tone: 'blue',
  })
  notifications.push({
    key: 'reviews',
    icon: <StarIcon />,
    label: 'Мои отзывы',
    hint: 'оставленные оценки',
    href: '/profile?tab=reviews',
    tone: 'green',
  })

  const menu: MenuItem[] = [
    { key: 'profile',   label: 'Настройки профиля', href: '/profile' },
    { key: 'orders',    label: 'Заказы',             href: '/profile?tab=orders' },
    { key: 'chat',      label: 'Чат с поддержкой',   href: '/profile?tab=chat', badge: unreadChats },
    { key: 'inquiries', label: 'Заявки',             href: '/profile?tab=inquiries' },
    { key: 'reviews',   label: 'Мои отзывы',         href: '/profile?tab=reviews' },
    { key: 'favorites', label: 'Избранное',          href: '/profile?tab=favorites', badge: favCount > 0 ? favCount : undefined },
    { key: 'support',   label: 'Поддержка',          href: '/support' },
  ]

  function handleLogout() {
    onClose()
    logout()
    if (onLogout) onLogout()
    else navigate('/')
  }

  if (!open) return null

  const initials = displayName.slice(0, 1).toUpperCase()

  return (
    <div ref={popoverRef} className="account-popover" role="dialog" aria-label="Меню аккаунта">
      {/* Left column — Notifications */}
      <div className="account-popover__col account-popover__col--notif">
        <header className="account-popover__col-head">
          <h3 className="account-popover__col-title">Уведомления</h3>
          <div className="account-popover__col-actions" aria-hidden="true">
            <span className="account-popover__icon-btn" title="Включить уведомления">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </span>
          </div>
        </header>

        <ul className="account-popover__notif-list">
          {notifications.map((n) => (
            <li key={n.key}>
              <Link
                to={n.href}
                className="account-popover__notif"
                onClick={onClose}
              >
                <span className={`account-popover__notif-icon account-popover__notif-icon--${n.tone ?? 'red'}`}>
                  {n.icon}
                </span>
                <span className="account-popover__notif-body">
                  <span className="account-popover__notif-label">{n.label}</span>
                  <span className="account-popover__notif-hint">{n.hint}</span>
                </span>
                {n.count !== undefined && n.count > 0 && (
                  <span className="account-popover__notif-count">{n.count}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Right column — User + menu */}
      <div className="account-popover__col account-popover__col--menu">
        <Link to="/profile" className="account-popover__user" onClick={onClose}>
          <span className="account-popover__avatar">
            {user.photo ? <img src={user.photo} alt="" /> : <span>{initials}</span>}
            {unreadChats > 0 && (
              <span className="account-popover__avatar-badge">{unreadChats}</span>
            )}
          </span>
          <span className="account-popover__user-text">
            <strong className="account-popover__user-name">{displayName}</strong>
            <span className="account-popover__user-email">{user.email}</span>
          </span>
        </Link>

        <ul className="account-popover__menu">
          {menu.map((item) => (
            <li key={item.key}>
              <Link
                to={item.href}
                className="account-popover__menu-link"
                onClick={onClose}
              >
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="account-popover__menu-badge">{item.badge}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>

        <button type="button" className="account-popover__logout" onClick={handleLogout}>
          {t('ui.profile.logout')}
        </button>
      </div>
    </div>
  )
}

// ─── Tiny inline icon set ──────────────────────────────────────────────
// Each icon uses currentColor so the parent's tone class drives the hue.
// Sized to 22px — matches DNS-shop's notification list ratio.

function BoxIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  )
}

function BubbleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function ChatBubbleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3z" />
      <line x1="7" y1="22" x2="7" y2="11" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
