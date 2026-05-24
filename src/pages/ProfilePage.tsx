import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AUTH_EVENT, getUser, logout, updateProfile, type User } from '../lib/auth'
import { FAVORITES_EVENT, getFavorites, removeFavorite } from '../lib/favorites'
import { getOrders, USER_DATA_EVENT, type Order as LocalOrder } from '../lib/userData'
import { fetchMyReviewsRemote, deleteReviewRemote, type RemoteReview } from '../lib/reviews'
import PhotoLightbox, { type LightboxState } from '../components/PhotoLightbox'
import ChatBubbleContent from '../components/ChatBubbleContent'
import ChatStatusIcon from '../components/ChatStatusIcon'
import { fileToPhotoMarker } from '../lib/chatMessage'
import { formatChatTime, formatThreadTime } from '../lib/chatFormat'
import { isOnline, formatLastSeen } from '../lib/presence'
import {
  fetchMyOrders,
  fetchMyInquiries,
  fetchThreadMessages,
  fetchMyThreads,
  createThread,
  setThreadStatus,
  sendChatMessage,
  markThreadSeen,
  trackingUrl,
  type ChatMessage,
  type ChatThread,
  type RemoteInquiry,
} from '../lib/customerInbox'
import { resizeImageToDataUrl } from '../lib/imageResize'
import { supabase } from '../lib/supabase'
import { useProducts } from '../hooks/useProducts'
import { productPath } from '../lib/productRoute'
import {
  CHAT_NOTIFICATIONS_READ_EVENT,
  CUSTOMER_CHAT_NOTIFICATION_EVENT,
  markChatNotificationsRead,
} from '../lib/chatNotifications'

type Tab = 'profile' | 'orders' | 'inquiries' | 'chat' | 'reviews' | 'favorites'

// Order IDs are stored prefixed: `remote-<dbId>` for orders that came back
// from /api/orders?my=, and `local-<timestamp>` for the optimistic local
// mirror. Display only the meaningful part: the DB id or the short
// timestamp tail. (Previously `.slice(-6)` chopped through the prefix and
// produced things like "ote-14".)
function formatOrderId(id: string): string {
  const m = /^(?:remote|local)-(.+)$/.exec(id)
  const rest = m ? m[1] : id
  // For long timestamps, keep the last 6 chars; for short DB ids leave them whole.
  return rest.length > 6 ? rest.slice(-6) : rest
}

// Valid query-param values that can deep-link into a tab. Keeps the type
// narrow so we don't accept arbitrary strings from the URL.
const TAB_VALUES: readonly Tab[] = ['profile', 'orders', 'inquiries', 'chat', 'reviews', 'favorites']
function parseTabParam(raw: string | null | undefined): Tab | null {
  if (!raw) return null
  return (TAB_VALUES as readonly string[]).includes(raw) ? (raw as Tab) : null
}

export default function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState<User | null>(() => getUser())
  // Deep-link support: the account popover links to /profile?tab=orders etc.
  // We seed `tab` from the URL on first render so the right section opens
  // immediately, and we keep it in sync when the URL changes (e.g. browser
  // back/forward, or the popover navigating again).
  const [tab, setTab] = useState<Tab>(() => parseTabParam(new URLSearchParams(location.search).get('tab')) ?? 'profile')
  const [unreadChatThreads, setUnreadChatThreads] = useState<Set<number | string>>(() => new Set())

  useEffect(() => {
    const next = parseTabParam(new URLSearchParams(location.search).get('tab'))
    if (next && next !== tab) setTab(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  // Reflect tab changes back into the URL so refreshes / back-button stay
  // on the right section. `replace: true` avoids polluting history with
  // every tab click.
  function selectTab(next: Tab) {
    setTab(next)
    const params = new URLSearchParams(location.search)
    if (next === 'profile') params.delete('tab')
    else params.set('tab', next)
    const qs = params.toString()
    navigate(`/profile${qs ? `?${qs}` : ''}`, { replace: true })
  }

  useEffect(() => {
    const sync = () => setUser(getUser())
    window.addEventListener(AUTH_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(AUTH_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  useEffect(() => {
    if (!user) {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  useEffect(() => {
    const onCustomerChat = (event: Event) => {
      if (tab === 'chat') {
        markChatNotificationsRead()
        return
      }
      const detail = (event as CustomEvent<{ threadKey?: number | string }>).detail
      const threadKey = detail?.threadKey ?? Date.now()
      setUnreadChatThreads((prev) => {
        const next = new Set(prev)
        next.add(threadKey)
        return next
      })
    }
    const clear = () => setUnreadChatThreads(new Set())
    window.addEventListener(CUSTOMER_CHAT_NOTIFICATION_EVENT, onCustomerChat)
    window.addEventListener(CHAT_NOTIFICATIONS_READ_EVENT, clear)
    return () => {
      window.removeEventListener(CUSTOMER_CHAT_NOTIFICATION_EVENT, onCustomerChat)
      window.removeEventListener(CHAT_NOTIFICATIONS_READ_EVENT, clear)
    }
  }, [tab])

  useEffect(() => {
    if (tab === 'chat') {
      markChatNotificationsRead()
      setUnreadChatThreads(new Set())
    }
  }, [tab])

  if (!user) return null

  return (
    <div className="page-shell">
      <div className="page-container">
        <header className="profile-hero">
          <div className="profile-hero__avatar">
            {user.photo ? (
              <img src={user.photo} alt={user.name} />
            ) : (
              <span>{(user.firstName?.[0] ?? user.name?.[0] ?? user.email[0]).toUpperCase()}</span>
            )}
          </div>
          <div className="profile-hero__copy">
            <span className="page-eyebrow">{t('ui.profile.menu')}</span>
            <h1 className="profile-hero__title">
              {t('ui.profile.hello')}, {user.firstName || user.name}
            </h1>
            <p className="profile-hero__email">
              {user.email}
              {/* Presence — only meaningful once the last_seen_at migration is
                * applied, otherwise we just don't show anything. */}
              {user.lastSeenAt && (
                <span style={{ marginLeft: 8 }}>
                  · <span className={`presence-label ${isOnline(user.lastSeenAt) ? 'presence-label--online' : ''}`.trim()}>
                    {isOnline(user.lastSeenAt) ? 'в сети' : formatLastSeen(user.lastSeenAt)}
                  </span>
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => { logout(); navigate('/') }}
          >
            {t('ui.profile.logout')}
          </button>
        </header>

        <nav className="profile-tabs" role="tablist">
          {(['profile', 'orders', 'inquiries', 'chat', 'reviews', 'favorites'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`profile-tab ${tab === key ? 'profile-tab--active' : ''}`.trim()}
              onClick={() => selectTab(key)}
            >
              {t(`ui.profile.tabs.${key}`)}
              {key === 'chat' && unreadChatThreads.size > 0 && (
                <span className="profile-tab__badge">{unreadChatThreads.size}</span>
              )}
            </button>
          ))}
        </nav>

        {tab === 'profile' && <ProfileForm user={user} />}
        {tab === 'orders' && <OrdersTab email={user.email} />}
        {tab === 'inquiries' && <InquiriesTab email={user.email} />}
        {tab === 'chat' && <ChatTab email={user.email} userName={user.firstName || user.name} />}
        {tab === 'reviews' && <ReviewsTab email={user.email} />}
        {tab === 'favorites' && <FavoritesTab />}
      </div>
    </div>
  )
}

function ProfileForm({ user }: { user: User }) {
  const { t } = useTranslation()
  const [firstName, setFirstName] = useState(user.firstName ?? '')
  const [lastName, setLastName] = useState(user.lastName ?? '')
  const [phone, setPhone] = useState(user.phone ?? '')
  const [telegram, setTelegram] = useState(user.telegram ?? '')
  const [photo, setPhoto] = useState(user.photo ?? '')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || user.name
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        telegram: telegram.trim(),
        photo: photo.trim(),
        name: fullName,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      const code = err instanceof Error ? err.message : 'unknown'
      setError(t(`ui.auth.errors.${code}`, { defaultValue: t('ui.auth.errors.UNKNOWN') }))
    } finally {
      setSaving(false)
    }
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Cap the source file at 8 MB (matches `accept="image/*"` realistic
    // mobile uploads). We then resize down to a 512px JPEG (~50–100 KB) so
    // big phone photos don't bloat the auth row.
    if (file.size > 8 * 1024 * 1024) {
      setError(t('ui.profile.profileSection.photoTooBig'))
      return
    }
    setError('')
    try {
      const dataUrl = await resizeImageToDataUrl(file, { maxSize: 512, quality: 0.85, mimeType: 'image/jpeg' })
      setPhoto(dataUrl)
    } catch {
      setError(t('ui.profile.profileSection.photoFailed'))
    }
    // Allow re-selecting the same file again (the input dedup'es by value).
    e.target.value = ''
  }

  return (
    <form className="profile-form" onSubmit={handleSubmit}>
      <h2 className="profile-form__title">{t('ui.profile.profileSection.title')}</h2>

      <div className="profile-form__photo-row">
        <div className="profile-form__photo-preview">
          {photo ? <img src={photo} alt="" /> : <div className="profile-form__photo-placeholder" />}
        </div>
        <div className="profile-form__photo-controls">
          <span className="catalog-field__label">{t('ui.profile.profileSection.photo')}</span>
          <p className="profile-form__photo-hint">{t('ui.profile.profileSection.photoHint')}</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <label className="cta-btn" style={{ cursor: 'pointer' }}>
              <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
              {t('ui.profile.profileSection.photoUpload')}
            </label>
            {photo && (
              <button type="button" className="ghost-btn" onClick={() => setPhoto('')}>
                {t('ui.profile.profileSection.photoRemove')}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="profile-form__row">
        <label className="catalog-field">
          <span className="catalog-field__label">{t('ui.profile.profileSection.firstName')}</span>
          <input
            className="catalog-search__input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
          />
        </label>
        <label className="catalog-field">
          <span className="catalog-field__label">{t('ui.profile.profileSection.lastName')}</span>
          <input
            className="catalog-search__input"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
          />
        </label>
      </div>

      <div className="profile-form__row">
        <label className="catalog-field">
          <span className="catalog-field__label">{t('ui.profile.profileSection.phone')}</span>
          <input
            className="catalog-search__input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t('ui.profile.profileSection.phonePlaceholder')}
            autoComplete="tel"
          />
        </label>
        <label className="catalog-field">
          <span className="catalog-field__label">{t('ui.profile.profileSection.telegram')}</span>
          <input
            className="catalog-search__input"
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder={t('ui.profile.profileSection.telegramPlaceholder')}
            autoComplete="off"
          />
        </label>
      </div>

      <div className="profile-form__row">
        <label className="catalog-field">
          <span className="catalog-field__label">email</span>
          <input className="catalog-search__input" value={user.email} disabled />
        </label>
        <div />
      </div>

      {error && <p className="profile-form__error">{error}</p>}

      <div className="profile-form__actions">
        <button type="submit" className="cta-btn" disabled={saving}>
          {saving
            ? t('ui.profile.profileSection.saving')
            : saved
              ? t('ui.profile.profileSection.saved')
              : t('ui.profile.profileSection.save')}
        </button>
      </div>
    </form>
  )
}

function OrdersTab({ email }: { email: string }) {
  const { t } = useTranslation()
  const [localOrders, setLocalOrders] = useState<LocalOrder[]>(() => getOrders(email))
  const [remoteOrders, setRemoteOrders] = useState<LocalOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sync = () => setLocalOrders(getOrders(email))
    window.addEventListener(USER_DATA_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(USER_DATA_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [email])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchMyOrders(email).then((rows) => {
      if (cancelled) return
      // Adapt remote shape to the local Order type so the existing UI renders.
      setRemoteOrders(rows.map<LocalOrder>((r) => ({
        id: `remote-${r.id}`,
        createdAt: new Date(r.created_at).getTime(),
        total: r.total,
        // Server orders use 'new' | 'in_progress' | 'done' | 'cancelled';
        // map them onto the four UI buckets the profile already knows about.
        status: r.status === 'new' ? 'pending' : r.status === 'in_progress' ? 'shipped' : r.status === 'done' ? 'delivered' : 'cancelled',
        items: (r.items ?? []).map((it) => ({ productId: it.id ?? 0, title: it.title, qty: it.quantity, price: it.price })),
        trackingNumber: r.tracking_number ?? null,
        trackingCarrier: r.tracking_carrier ?? null,
      })))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [email])

  // Prefer remote when both have the same time window — keeps statuses fresh.
  const merged = [...remoteOrders, ...localOrders.filter((lo) => !remoteOrders.some((ro) => Math.abs(ro.createdAt - lo.createdAt) < 60_000 && ro.total === lo.total))]
  merged.sort((a, b) => b.createdAt - a.createdAt)
  const orders = merged

  if (orders.length === 0 && !loading) {
    return (
      <div className="profile-empty">
        <p>{t('ui.profile.ordersEmpty')}</p>
        <Link to="/catalog" className="cta-btn" style={{ textDecoration: 'none' }}>
          {t('ui.profile.goCatalog')}
        </Link>
      </div>
    )
  }

  return (
    <div className="profile-list">
      {orders.map((order) => (
        <article key={order.id} className="profile-card">
          <div className="profile-card__head">
            <span className="profile-card__title">
              {t('ui.profile.orderId')}{formatOrderId(order.id)}
            </span>
            <span className={`profile-status profile-status--${order.status}`}>
              {t(`ui.profile.orderStatus.${order.status}`)}
            </span>
          </div>
          <p className="profile-card__meta">
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
          <ul className="profile-card__items">
            {order.items.map((item) => (
              <li key={`${order.id}-${item.productId}`}>
                <span>{item.title}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                  <span>{item.qty} × {item.price.toLocaleString('ru-RU')} ₽</span>
                  {order.status === 'delivered' && item.productId > 0 && (
                    <Link
                      to={`/product/${item.productId}?review=1`}
                      className="profile-card__leave-review"
                    >
                      {t('ui.productPage.reviewLeaveFromOrder')}
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="profile-card__total">
            <span>total</span>
            <strong>{order.total.toLocaleString('ru-RU')} ₽</strong>
          </div>
          {order.trackingNumber && (() => {
            const url = trackingUrl(order.trackingCarrier, order.trackingNumber)
            const carrierLabel =
              order.trackingCarrier === 'cdek' ? 'CDEK' :
              order.trackingCarrier === 'post' ? 'Почта России' :
              order.trackingCarrier === 'avito' ? 'Avito' :
              (order.trackingCarrier || 'трекинг')
            return (
              <div className="profile-card__tracking">
                <span className="profile-card__tracking-label">{carrierLabel}:</span>
                <code className="profile-card__tracking-num">{order.trackingNumber}</code>
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="profile-card__tracking-link">
                    отследить →
                  </a>
                )}
              </div>
            )
          })()}
        </article>
      ))}
    </div>
  )
}

function ReviewsTab({ email }: { email: string }) {
  const { t } = useTranslation()
  const [reviews, setReviews] = useState<RemoteReview[]>([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchMyReviewsRemote(email).then((rows) => {
      if (cancelled) return
      setReviews(rows)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [email])

  if (loading) return <div className="profile-empty"><p>{t('ui.profile.reviewsLoading')}</p></div>

  if (reviews.length === 0) {
    return (
      <div className="profile-empty">
        <p>{t('ui.profile.reviewsEmpty')}</p>
        <Link to="/catalog" className="cta-btn" style={{ textDecoration: 'none' }}>
          {t('ui.profile.goCatalog')}
        </Link>
      </div>
    )
  }

  return (
    <div className="profile-list">
      {reviews.map((review) => (
        <article key={review.id} className="profile-card">
          <div className="profile-card__head">
            <Link to={`/product/${review.product_id}`} className="profile-card__title">
              {t('ui.profile.reviewForProduct')} #{review.product_id}
            </Link>
            <button
              type="button"
              className="profile-card__action"
              onClick={async () => {
                try {
                  await deleteReviewRemote(review.id, email)
                  setReviews((prev) => prev.filter((r) => r.id !== review.id))
                } catch { /* keep entry until next refresh if delete failed */ }
              }}
            >
              {t('ui.profile.reviewDelete')}
            </button>
          </div>
          <div className="profile-card__rating" aria-label={`${t('ui.profile.reviewRating')}: ${review.rating}/5`}>
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={i < review.rating ? 'star star--filled' : 'star'}>★</span>
            ))}
          </div>
          <p className="profile-card__text">{review.text}</p>
          {review.photos && review.photos.length > 0 && (
            <div className="product-reviews__photos product-reviews__photos--shown">
              {review.photos.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  className="product-reviews__photo product-reviews__photo--shown"
                  onClick={() => setLightbox({ images: review.photos ?? [], index: i })}
                  aria-label="открыть фото"
                >
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          <p className="profile-card__meta">{new Date(review.created_at).toLocaleDateString()}</p>
        </article>
      ))}

      <PhotoLightbox
        state={lightbox}
        onClose={() => setLightbox(null)}
        onChange={setLightbox}
      />
    </div>
  )
}

function FavoritesTab() {
  const { t } = useTranslation()
  const { products } = useProducts()
  const [ids, setIds] = useState<number[]>(() => getFavorites())

  useEffect(() => {
    const sync = () => setIds(getFavorites())
    window.addEventListener(FAVORITES_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const favoriteProducts = products.filter((p) => ids.includes(p.id))

  if (favoriteProducts.length === 0) {
    return (
      <div className="profile-empty">
        <p>{t('ui.profile.favoritesEmpty')}</p>
        <Link to="/catalog" className="cta-btn" style={{ textDecoration: 'none' }}>
          {t('ui.profile.goCatalog')}
        </Link>
      </div>
    )
  }

  return (
    <div className="profile-favorites">
      {favoriteProducts.map((product) => (
        <article key={product.id} className="profile-favorite">
          <Link to={productPath(product)} className="profile-favorite__cover" aria-label={product.titleDirect ?? ''} />
          <img className="profile-favorite__image" src={product.image} alt="" loading="lazy" decoding="async" />
          <div className="profile-favorite__body">
            <p className="profile-favorite__brand">{product.brand}</p>
            <h3 className="profile-favorite__title">{product.titleDirect ?? product.titleKey}</h3>
            <div className="profile-favorite__footer">
              <strong>{product.price.toLocaleString('ru-RU')} ₽</strong>
              <button
                type="button"
                className="profile-card__action"
                onClick={() => removeFavorite(product.id)}
              >
                {t('ui.profile.favoriteRemove')}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function InquiriesTab({ email }: { email: string }) {
  const { t } = useTranslation()
  const [items, setItems] = useState<RemoteInquiry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchMyInquiries(email).then((rows) => {
      if (cancelled) return
      setItems(rows)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [email])

  if (loading && items.length === 0) {
    return <div className="profile-empty"><p>{t('ui.profile.inquiriesLoading')}</p></div>
  }

  if (items.length === 0) {
    return (
      <div className="profile-empty">
        <p>{t('ui.profile.inquiriesEmpty')}</p>
        <Link to="/support" className="cta-btn" style={{ textDecoration: 'none' }}>
          {t('ui.profile.openSupport')}
        </Link>
      </div>
    )
  }

  return (
    <div className="profile-list">
      {items.map((q) => (
        <article key={q.id} className="profile-card">
          <div className="profile-card__head">
            <span className="profile-card__title">#{q.id} · {t(`ui.profile.inquiryCategory.${q.category}`)}</span>
            <span className={`profile-status profile-status--${q.status === 'new' ? 'pending' : q.status === 'in_progress' ? 'shipped' : 'delivered'}`}>
              {t(`ui.profile.inquiryStatus.${q.status}`)}
            </span>
          </div>
          <p className="profile-card__meta">{new Date(q.created_at).toLocaleString('ru-RU')}</p>
          <p className="profile-card__text">{q.message}</p>
        </article>
      ))}
    </div>
  )
}

function ChatTab({ email, userName: _userName }: { email: string; userName: string }) {
  const { t } = useTranslation()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  // Pending photo markers — appended to the body on send, then cleared.
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([])
  const [attaching, setAttaching] = useState(false)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [chatLightbox, setChatLightbox] = useState<LightboxState | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  async function loadThreads() {
    const rows = await fetchMyThreads(email)
    setThreads(rows)
    setActiveId((current) => {
      if (!current) return current
      return rows.some((thread) => thread.id === current) ? current : null
    })
    return rows
  }

  async function loadMessages(threadId: number) {
    const rows = await fetchThreadMessages(threadId)
    // Merge with any optimistic placeholders still in-flight (negative IDs)
    // so the bubble doesn't blink out and back in while the network race
    // resolves. Real messages from the server overwrite same-id placeholders
    // by definition (negative IDs never collide with positive ones).
    setMessages((prev) => {
      const pending = prev.filter((m) => m.clientStatus === 'sending' && m.id < 0)
      // Drop optimistic items that are now reconciled (matched by body+sender
      // arriving within ~30s). Lets late acks merge cleanly.
      const stillPending = pending.filter((p) => !rows.some(
        (r) => r.sender === p.sender && r.body === p.body &&
          Math.abs(new Date(r.created_at).getTime() - new Date(p.created_at).getTime()) < 30_000,
      ))
      return [...rows, ...stillPending]
    })
  }

  useEffect(() => {
    setLoading(true)
    void loadThreads().then((rows) => {
      // Pre-select the most recent open thread, or just the most recent one.
      const pick = rows.find((th) => th.status === 'open') ?? rows[0] ?? null
      setActiveId(pick ? pick.id : null)
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  useEffect(() => {
    const refresh = () => { void loadThreads() }
    const sb = supabase
    if (sb) {
      const threadChannel = sb
        .channel(`profile-chat-threads-${email}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_threads', filter: `user_email=eq.${email}` },
          refresh,
        )
        .subscribe()
      const messageChannel = sb
        .channel(`profile-chat-thread-bumps-${email}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_email=eq.${email}` },
          refresh,
        )
        .subscribe()
      const poll = window.setInterval(refresh, 4_000)
      return () => {
        void sb.removeChannel(threadChannel)
        void sb.removeChannel(messageChannel)
        window.clearInterval(poll)
      }
    }
    const poll = window.setInterval(refresh, 4_000)
    return () => window.clearInterval(poll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    void loadMessages(activeId)
    // Telegram-style read receipts: bump our seen_at on the thread the moment
    // the user opens it. Best-effort — the server tolerates missing schema.
    // We do this on every visibility refresh too (focus / channel push) so
    // staying on the thread keeps the admin's ✓✓ accurate.
    void markThreadSeen(activeId)
    const sb = supabase
    if (sb) {
      const channel = sb
        .channel(`chat-thread-${activeId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${activeId}` },
          () => {
            void loadMessages(activeId)
            void markThreadSeen(activeId)
          },
        )
        .subscribe()
      const poll = window.setInterval(() => { void loadMessages(activeId) }, 3_000)
      return () => {
        void sb.removeChannel(channel)
        window.clearInterval(poll)
      }
    }
    const tm = window.setInterval(() => { void loadMessages(activeId) }, 3_000)
    return () => window.clearInterval(tm)
  }, [activeId])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  const activeThread = threads.find((th) => th.id === activeId) ?? null

  async function sendMessage() {
    if (!activeId || activeThread?.status !== 'open') return
    const text = draft.trim()
    // Allow sending if there's either text or attached photos.
    if (!text && pendingPhotos.length === 0) return
    // Photos are appended after the text — the renderer (ChatBubbleContent)
    // strips and lays them out separately.
    const fullBody = [text, ...pendingPhotos].filter(Boolean).join('\n')

    // Optimistic placeholder — appears immediately in the UI with a "sending"
    // status (⏱). Negative ID guarantees no collision with real server IDs;
    // the reconciler in `loadMessages` drops it once the server-side row
    // shows up via realtime push or polling. On the happy path the explicit
    // ack below replaces it first, so the swap is invisible.
    const tempId = -Date.now()
    const optimistic: ChatMessage = {
      id: tempId,
      sender: 'user',
      body: fullBody,
      created_at: new Date().toISOString(),
      thread_id: activeId,
      clientStatus: 'sending',
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft('')
    setPendingPhotos([])
    setError('')
    setSending(true)

    try {
      const sent = await sendChatMessage(email, fullBody, activeId)
      // Replace the optimistic row by tempId. The real row has clientStatus
      // implicit-undefined → renderer treats it as 'sent'.
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...sent, clientStatus: 'sent' as const } : m)))
      void loadThreads()
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      // Mark the optimistic row as failed so the user sees a retry hint
      // instead of having their text vanish. The bubble renders a ⚠ icon
      // and a clickable retry handler (below in JSX).
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, clientStatus: 'failed' as const } : m)))
      if (/table_not_found|schema cache|public\.messages/.test(raw)) {
        setError(t('ui.profile.chatUnavailable'))
      } else if (/thread_closed/.test(raw)) {
        setError(t('ui.profile.chatThreadClosedError'))
        void loadThreads()
      } else if (/message_rate_limited|too many requests|429/.test(raw)) {
        setError(t('ui.profile.chatRateLimited'))
      } else {
        setError(raw)
      }
    } finally {
      setSending(false)
    }
  }

  // Retry a previously-failed optimistic message. Drops the failed row, then
  // restages the same body through the optimistic path so the placeholder
  // appears anew with a 'sending' status.
  async function retryFailed(failed: ChatMessage) {
    if (!activeId) return
    setMessages((prev) => prev.filter((m) => m.id !== failed.id))
    const tempId = -Date.now()
    const optimistic: ChatMessage = {
      ...failed,
      id: tempId,
      created_at: new Date().toISOString(),
      clientStatus: 'sending',
    }
    setMessages((prev) => [...prev, optimistic])
    setError('')
    setSending(true)
    try {
      const sent = await sendChatMessage(email, failed.body, activeId)
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...sent, clientStatus: 'sent' as const } : m)))
      void loadThreads()
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, clientStatus: 'failed' as const } : m)))
      setError(err instanceof Error ? err.message : 'failed')
    } finally {
      setSending(false)
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    await sendMessage()
  }

  const handleDraftKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  async function handleCreate() {
    const title = newTitle.trim() || t('ui.profile.chatNewDefault')
    setError('')
    try {
      const created = await createThread(email, title)
      setThreads((prev) => [created, ...prev])
      setActiveId(created.id)
      setNewTitle('')
      setCreating(false)
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      if (/table_not_found|schema cache/.test(raw)) {
        setError(t('ui.profile.chatUnavailable'))
      } else if (/^(unauthorized|401|403)$/i.test(raw.trim()) || /token_missing_or_invalid/.test(raw)) {
        // Session lost — push user back to login. Auto-clear stale token
        // so the next page-load shows the auth modal cleanly.
        setError('Сессия истекла, войдите снова чтобы создать чат.')
      } else {
        setError(`Не удалось создать чат: ${raw}`)
      }
    }
  }

  async function closeThread(id: number) {
    if (!confirm(t('ui.profile.chatCloseConfirm'))) return
    try {
      const updated = await setThreadStatus(id, email, 'closed')
      setThreads((prev) => prev.map((th) => (th.id === id ? updated : th)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed')
    }
  }

  return (
    <div className="profile-chat-shell">
      <aside className="profile-chat-threads">
        <header className="profile-chat-threads__head">
          <h3>{t('ui.profile.chatYourThreads')}</h3>
          <button type="button" className="ghost-btn" onClick={() => setCreating((v) => !v)}>
            {creating ? t('ui.profile.chatCancel') : t('ui.profile.chatNewBtn')}
          </button>
        </header>
        {creating && (
          <div className="profile-chat-threads__new">
            <input
              className="profile-chat__input"
              placeholder={t('ui.profile.chatNewPlaceholder')}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <button type="button" className="cta-btn" onClick={() => void handleCreate()}>
              {t('ui.profile.chatCreate')}
            </button>
          </div>
        )}
        {loading ? (
          <p className="profile-chat__empty">{t('ui.profile.chatLoading')}</p>
        ) : threads.length === 0 ? (
          <p className="profile-chat__empty">{t('ui.profile.chatNoThreads')}</p>
        ) : (
          <ul className="profile-chat-threads__list">
            {threads.map((th) => (
              <li key={th.id}>
                <button
                  type="button"
                  className={`profile-chat-thread ${activeId === th.id ? 'profile-chat-thread--active' : ''} profile-chat-thread--${th.status}`.trim()}
                  onClick={() => setActiveId(th.id)}
                >
                  <span className="profile-chat-thread__title">{th.title || t('ui.profile.chatNewDefault')}</span>
                  <span className={`profile-chat-thread__status profile-chat-thread__status--${th.status}`}>
                    {th.status === 'open' ? t('ui.profile.chatStatusOpen') : t('ui.profile.chatStatusClosed')}
                  </span>
                  <span className="profile-chat-thread__time">
                    {formatThreadTime(th.last_message_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="profile-chat">
        <header className="profile-chat__head">
          <div>
            <h3>{activeThread?.title || t('ui.profile.chatTitle')}</h3>
            <p className="profile-chat__meta">{t('ui.profile.chatMeta')}</p>
          </div>
          {activeThread && (
            activeThread.status === 'open' && (
              <button type="button" className="ghost-btn" onClick={() => void closeThread(activeThread.id)}>
                {t('ui.profile.chatCloseBtn')}
              </button>
            )
          )}
        </header>
        <div ref={listRef} className="profile-chat__list">
          {!activeThread ? (
            <p className="profile-chat__empty">{t('ui.profile.chatPickOrCreate')}</p>
          ) : messages.length === 0 ? (
            <p className="profile-chat__empty">{t('ui.profile.chatEmpty')}</p>
          ) : (
            messages.map((m) => {
              // Read-receipt resolution: messages we sent are "read" when the
              // other side's seen_at is >= our message's created_at. The
              // server may not yet expose `last_admin_seen_at` (schema
              // migration optional) — when undefined we fall back to "sent".
              const isOwn = m.sender === 'user'
              const otherSeenAt = isOwn ? activeThread?.last_admin_seen_at : null
              const status: 'sending' | 'failed' | 'sent' | 'read' =
                m.clientStatus === 'sending' ? 'sending'
                : m.clientStatus === 'failed' ? 'failed'
                : (otherSeenAt && new Date(otherSeenAt) >= new Date(m.created_at)) ? 'read'
                : 'sent'
              return (
                <div key={m.id} className={`profile-chat__msg profile-chat__msg--${m.sender}`}>
                  <div className={`profile-chat__bubble profile-chat__bubble--${status}`}>
                    {/* No sender label at all — the bubble's side/colour and the
                      * conversation header at the top of the chat panel already
                      * make it obvious who's writing. */}
                    <ChatBubbleContent
                      body={m.body}
                      onOpenPhoto={(urls, index) => setChatLightbox({ images: urls, index })}
                    />
                    <div className="profile-chat__bubble-foot">
                      <time>{formatChatTime(m.created_at)}</time>
                      {isOwn && <ChatStatusIcon status={status} onRetry={status === 'failed' ? () => void retryFailed(m) : undefined} />}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
        {activeThread && activeThread.status === 'open' && (
          <>
            {pendingPhotos.length > 0 && (
              <div className="chat-attach-preview">
                {pendingPhotos.map((marker, i) => {
                  // marker is `[[photo:DATAURL]]` — strip wrapper for thumb src
                  const src = marker.replace(/^\[\[photo:/, '').replace(/\]\]$/, '')
                  return (
                    <div key={i} className="chat-attach-preview__item">
                      <img src={src} alt="" />
                      <button
                        type="button"
                        className="chat-attach-preview__remove"
                        onClick={() => setPendingPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label="убрать фото"
                      >×</button>
                    </div>
                  )
                })}
              </div>
            )}
            <form className="profile-chat__form" onSubmit={(e) => { void send(e) }}>
              <label className={`chat-attach-btn ${attaching ? 'chat-attach-btn--busy' : ''}`.trim()} title="прикрепить фото">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={attaching || sending}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files ?? [])
                    if (files.length === 0) return
                    setAttaching(true)
                    try {
                      const markers: string[] = []
                      for (const f of files.slice(0, 4)) {
                        const m = await fileToPhotoMarker(f)
                        if (m) markers.push(m)
                      }
                      setPendingPhotos((prev) => [...prev, ...markers].slice(0, 4))
                    } finally {
                      setAttaching(false)
                      e.target.value = ''
                    }
                  }}
                />
              </label>
              <textarea
                className="profile-chat__input"
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder={t('ui.profile.chatPlaceholder')}
                disabled={sending}
              />
              <button
                type="submit"
                className="cta-btn"
                disabled={sending || (!draft.trim() && pendingPhotos.length === 0)}
              >
                {sending ? t('ui.profile.chatSending') : t('ui.profile.chatSend')}
              </button>
            </form>
          </>
        )}
        {activeThread && activeThread.status === 'closed' && (
          <p className="profile-chat__closed-note">{t('ui.profile.chatClosedNote')}</p>
        )}
        {error && <p className="profile-chat__error">{error}</p>}
      </section>

      <PhotoLightbox
        state={chatLightbox}
        onClose={() => setChatLightbox(null)}
        onChange={setChatLightbox}
      />
    </div>
  )
}
