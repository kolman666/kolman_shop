import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AUTH_EVENT, getUser, logout, updateProfile, type User } from '../lib/auth'
import { FAVORITES_EVENT, getFavorites, removeFavorite } from '../lib/favorites'
import { getOrders, getReviews, removeReview, USER_DATA_EVENT, type Order as LocalOrder } from '../lib/userData'
import { fetchMyOrders, fetchMyInquiries, fetchChatMessages, sendChatMessage, type ChatMessage, type RemoteInquiry } from '../lib/customerInbox'
import { useProducts } from '../hooks/useProducts'
import { productPath } from '../lib/productRoute'

type Tab = 'profile' | 'orders' | 'inquiries' | 'chat' | 'reviews' | 'favorites'

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
  const [photo, setPhoto] = useState(user.photo ?? '')
  const [saved, setSaved] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ') || user.name
    updateProfile({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      photo: photo.trim(),
      name: fullName,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setPhoto(reader.result)
    }
    reader.readAsDataURL(file)
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
          <span className="catalog-field__label">email</span>
          <input className="catalog-search__input" value={user.email} disabled />
        </label>
      </div>

      <div className="profile-form__actions">
        <button type="submit" className="cta-btn">
          {saved ? t('ui.profile.profileSection.saved') : t('ui.profile.profileSection.save')}
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
              {t('ui.profile.orderId')}{order.id.slice(-6)}
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
                <span>{item.qty} × {item.price.toLocaleString('ru-RU')} ₽</span>
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
  const [reviews, setReviews] = useState(() => getReviews(email))

  useEffect(() => {
    const sync = () => setReviews(getReviews(email))
    window.addEventListener(USER_DATA_EVENT, sync)
    return () => window.removeEventListener(USER_DATA_EVENT, sync)
  }, [email])

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
            <span className="profile-card__title">{review.productTitle}</span>
            <button
              type="button"
              className="profile-card__action"
              onClick={() => removeReview(email, review.id)}
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
          <p className="profile-card__meta">{new Date(review.createdAt).toLocaleDateString()}</p>
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  async function load() {
    setLoading(true)
    const rows = await fetchChatMessages(email)
    setMessages(rows)
    setLoading(false)
  }

  useEffect(() => {
    void load()
    // Poll every 8s while the tab is open — cheap, simple.
    const t = window.setInterval(load, 8_000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  useEffect(() => {
    if (!listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setSending(true)
    setError('')
    try {
      const sent = await sendChatMessage(email, text)
      setMessages((prev) => [...prev, sent])
      setDraft('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="profile-chat">
      <header className="profile-chat__head">
        <h3>{t('ui.profile.chatTitle')}</h3>
        <p className="profile-chat__meta">{t('ui.profile.chatMeta')}</p>
      </header>
      <div ref={listRef} className="profile-chat__list">
        {loading && messages.length === 0 ? (
          <p className="profile-chat__empty">{t('ui.profile.chatLoading')}</p>
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
      {error && <p className="profile-chat__error">{error}</p>}
    </div>
  )
}
