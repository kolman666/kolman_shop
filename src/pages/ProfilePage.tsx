import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AUTH_EVENT, getUser, logout, updateProfile, type User } from '../lib/auth'
import { FAVORITES_EVENT, getFavorites, removeFavorite } from '../lib/favorites'
import { getOrders, USER_DATA_EVENT, type Order as LocalOrder } from '../lib/userData'
import { fetchMyReviewsRemote, deleteReviewRemote, type RemoteReview } from '../lib/reviews'
import {
  fetchMyOrders,
  fetchMyInquiries,
  fetchThreadMessages,
  fetchMyThreads,
  createThread,
  setThreadStatus,
  sendChatMessage,
  type ChatMessage,
  type ChatThread,
  type RemoteInquiry,
} from '../lib/customerInbox'
import { resizeImageToDataUrl } from '../lib/imageResize'
import { supabase } from '../lib/supabase'
import { useProducts } from '../hooks/useProducts'
import { productPath } from '../lib/productRoute'

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

export default function ProfilePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(() => getUser())
  const [tab, setTab] = useState<Tab>('profile')

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
            <p className="profile-hero__email">{user.email}</p>
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
              onClick={() => setTab(key)}
            >
              {t(`ui.profile.tabs.${key}`)}
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
        </article>
      ))}
    </div>
  )
}

function ReviewsTab({ email }: { email: string }) {
  const { t } = useTranslation()
  const [reviews, setReviews] = useState<RemoteReview[]>([])
  const [loading, setLoading] = useState(true)

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
                <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="product-reviews__photo product-reviews__photo--shown">
                  <img src={src} alt="" loading="lazy" />
                </a>
              ))}
            </div>
          )}
          <p className="profile-card__meta">{new Date(review.created_at).toLocaleDateString()}</p>
        </article>
      ))}
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
          <img className="profile-favorite__image" src={product.image} alt="" />
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

function ChatTab({ email, userName }: { email: string; userName: string }) {
  const { t } = useTranslation()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  async function loadThreads() {
    const rows = await fetchMyThreads(email)
    setThreads(rows)
    return rows
  }

  async function loadMessages(threadId: number) {
    const rows = await fetchThreadMessages(threadId)
    setMessages(rows)
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
    if (!activeId) { setMessages([]); return }
    void loadMessages(activeId)
    const sb = supabase
    if (sb) {
      const channel = sb
        .channel(`chat-thread-${activeId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${activeId}` },
          () => { void loadMessages(activeId) },
        )
        .subscribe()
      return () => { void sb.removeChannel(channel) }
    }
    const tm = window.setInterval(() => { void loadMessages(activeId) }, 8_000)
    return () => window.clearInterval(tm)
  }, [activeId])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  const activeThread = threads.find((th) => th.id === activeId) ?? null

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!activeId) return
    const text = draft.trim()
    if (!text) return
    setSending(true)
    setError('')
    try {
      const sent = await sendChatMessage(email, text, activeId)
      setMessages((prev) => [...prev, sent])
      setDraft('')
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err)
      if (/table_not_found|schema cache|public\.messages/.test(raw)) {
        setError(t('ui.profile.chatUnavailable'))
      } else {
        setError(raw)
      }
    } finally {
      setSending(false)
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
      } else {
        setError(raw)
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

  async function reopenThread(id: number) {
    try {
      const updated = await setThreadStatus(id, email, 'open')
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
                    {new Date(th.last_message_at).toLocaleString('ru-RU')}
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
            activeThread.status === 'open' ? (
              <button type="button" className="ghost-btn" onClick={() => void closeThread(activeThread.id)}>
                {t('ui.profile.chatCloseBtn')}
              </button>
            ) : (
              <button type="button" className="ghost-btn" onClick={() => void reopenThread(activeThread.id)}>
                {t('ui.profile.chatReopenBtn')}
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
            messages.map((m) => (
              <div key={m.id} className={`profile-chat__msg profile-chat__msg--${m.sender}`}>
                <div className="profile-chat__bubble">
                  <span className="profile-chat__sender">
                    {m.sender === 'user' ? userName : t('ui.profile.chatAdmin')}
                  </span>
                  <p>{m.body}</p>
                  <time>{new Date(m.created_at).toLocaleString('ru-RU')}</time>
                </div>
              </div>
            ))
          )}
        </div>
        {activeThread && activeThread.status === 'open' && (
          <form className="profile-chat__form" onSubmit={(e) => { void send(e) }}>
            <textarea
              className="profile-chat__input"
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('ui.profile.chatPlaceholder')}
              disabled={sending}
            />
            <button type="submit" className="cta-btn" disabled={sending || !draft.trim()}>
              {sending ? t('ui.profile.chatSending') : t('ui.profile.chatSend')}
            </button>
          </form>
        )}
        {activeThread && activeThread.status === 'closed' && (
          <p className="profile-chat__closed-note">{t('ui.profile.chatClosedNote')}</p>
        )}
        {error && <p className="profile-chat__error">{error}</p>}
      </section>
    </div>
  )
}
