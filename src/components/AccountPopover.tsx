import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { logout, type User } from '../lib/auth'
import { getFavoritesCount, FAVORITES_EVENT } from '../lib/favorites'
import { getCartCount } from '../lib/cart'
import { fetchMyThreads, type ChatThread } from '../lib/customerInbox'
import { formatThreadTime } from '../lib/chatFormat'

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
  // Two-state animation: `mounted` keeps the popover in the DOM long
  // enough for a closing transition to play. `phase` decides which
  // animation class to apply (entering vs leaving). When the parent
  // sets `open=false`, we flip phase to 'closing', wait for the CSS
  // animation to finish, then unmount.
  const [mounted, setMounted] = useState(open)
  const [phase, setPhase] = useState<'open' | 'closing'>('open')

  useEffect(() => {
    if (open) {
      setMounted(true)
      // Next paint frame so the open animation starts from its
      // pre-paint state (otherwise React batches and skips the
      // transition).
      requestAnimationFrame(() => setPhase('open'))
      return
    }
    if (!mounted) return
    setPhase('closing')
    const ANIM_MS = 220
    const t = window.setTimeout(() => setMounted(false), ANIM_MS)
    return () => window.clearTimeout(t)
  }, [open, mounted])
  // Recent chat threads — fetched lazily on first open so the popover never
  // adds bandwidth to a page nav. `loadingChats` lets us show a 1-line
  // skeleton while the round-trip completes.
  const [chatThreads, setChatThreads] = useState<ChatThread[]>([])
  const [loadingChats, setLoadingChats] = useState(false)

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

  // Pull the user's chat threads when the popover opens. Each thread carries
  // its `last_message_preview` + (optionally) `last_message_photo` so we
  // can render an inline chat row with a 32×32 thumbnail. Re-fetched every
  // time the popover opens so previews stay fresh.
  useEffect(() => {
    if (!open || !user.email) return
    let cancelled = false
    setLoadingChats(true)
    void fetchMyThreads(user.email)
      .then((rows) => {
        if (cancelled) return
        setChatThreads(rows)
      })
      .finally(() => {
        if (!cancelled) setLoadingChats(false)
      })
    return () => { cancelled = true }
  }, [open, user.email])

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

  // Notification-style filter: only render threads with unread admin
  // messages — anything the user has already read shouldn't clutter the
  // popover. If everything is read, the section is hidden entirely so the
  // notifications column doesn't carry empty headers.
  const recentChats = chatThreads
    .filter((th) => (th.unread_admin_messages ?? 0) > 0)
    .slice(0, 4)
  const hasAnyChat = recentChats.length > 0

  // Notification cards — only render the ones with actual signal so an
  // empty account doesn't feel cluttered. Each has a tone for the icon
  // colour and a count badge when relevant. Chat goes on top via its own
  // dedicated section (renderChatRows below), so we skip it here.
  const notifications: NotificationItem[] = []

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

  if (!mounted) return null

  const initials = displayName.slice(0, 1).toUpperCase()

  return (
    <div
      ref={popoverRef}
      className={`account-popover account-popover--${phase}`}
      role="dialog"
      aria-label="Меню аккаунта"
    >
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

        {/* Real chat threads with last-message previews + photo thumbs.
          * Server fills `last_message_preview`, `last_message_sender`, and
          * (when there's an image) `last_message_photo` — see
          * api/messages.js threads branch. Each row links straight to the
          * /profile chat tab so the user lands inside that conversation.
          */}
        {hasAnyChat && (
          <div className="account-popover__chats">
            <div className="account-popover__chats-head">
              <span>Сообщения</span>
              <Link to="/profile?tab=chat" className="account-popover__chats-all" onClick={onClose}>
                все чаты →
              </Link>
            </div>
            <ul className="account-popover__chat-list">
              {recentChats.map((th) => {
                const isOwn = th.last_message_sender === 'user'
                const senderLabel = isOwn ? 'Вы: ' : ''
                // Customer-side unread = admin messages the user hasn't opened.
                const unread = th.unread_admin_messages ?? 0
                const preview = th.last_message_preview ?? (th.last_message_photo ? '📷 фото' : 'нет сообщений')
                return (
                  <li key={th.id}>
                    <Link
                      to="/profile?tab=chat"
                      className={`account-popover__chat ${unread > 0 ? 'account-popover__chat--unread' : ''}`.trim()}
                      onClick={onClose}
                    >
                      <span className="account-popover__chat-thumb">
                        {th.last_message_photo ? (
                          <img src={th.last_message_photo} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="account-popover__chat-thumb-fallback">
                            <BubbleIcon />
                          </span>
                        )}
                      </span>
                      <span className="account-popover__chat-body">
                        <span className="account-popover__chat-title-row">
                          <span className="account-popover__chat-title">{th.title || 'Чат с поддержкой'}</span>
                          <time className="account-popover__chat-time">{formatThreadTime(th.last_message_at)}</time>
                        </span>
                        <span className="account-popover__chat-preview">
                          <span className={isOwn ? 'account-popover__chat-sender' : ''}>{senderLabel}</span>
                          {preview}
                        </span>
                      </span>
                      {unread > 0 && (
                        <span className="account-popover__chat-badge">{unread}</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Skeleton only fires on the very first fetch (no threads yet). After
          * load, an empty result simply means "no unread chats" — we render
          * nothing rather than a stale placeholder. */}
        {loadingChats && chatThreads.length === 0 && (
          <div className="account-popover__chats-skel" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="account-popover__chat-skel">
                <span className="account-popover__chat-skel-thumb" />
                <span className="account-popover__chat-skel-body">
                  <span className="account-popover__chat-skel-line" style={{ width: '60%' }} />
                  <span className="account-popover__chat-skel-line" style={{ width: '85%' }} />
                </span>
              </div>
            ))}
          </div>
        )}

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

// ─── Inline icon set ───────────────────────────────────────────────────
// Same paths the admin sidebar uses (see ADMIN_NAV in AdminPage.tsx) so the
// notification cards feel like part of the same visual system. Stroke 1.7,
// 22×22 — matches the admin sidebar look + the DNS-shop notification list
// proportions.

// "Orders" — shopping cart with wheels (admin's `orders` tab).
function BoxIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  )
}

// "Cart & favourites" — admin's promo tab (price tag) doubles for this
// combined card since it represents purchase intent in general.
function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  )
}

// "Chat" — speech bubble (admin's `chat` tab).
function BubbleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}

// "Inquiries" — document with lines (admin's `inquiries` tab).
function ChatBubbleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="15" y2="17" />
    </svg>
  )
}

// "Reviews" — five-point star, drawn with the same line-art weight as the
// admin sidebar icons (admin doesn't have a Reviews tab so there's no
// direct match to copy).
function StarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
