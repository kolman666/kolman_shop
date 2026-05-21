import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AUTH_EVENT, getUser, logout, updateProfile, type User } from '../lib/auth'
import { FAVORITES_EVENT, getFavorites, removeFavorite } from '../lib/favorites'
import { getOrders, getReviews, removeReview, USER_DATA_EVENT } from '../lib/userData'
import { useProducts } from '../hooks/useProducts'
import { productPath } from '../lib/productRoute'

type Tab = 'profile' | 'orders' | 'reviews' | 'favorites'

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
          {(['profile', 'orders', 'reviews', 'favorites'] as const).map((key) => (
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
          <label className="catalog-field">
            <span className="catalog-field__label">{t('ui.profile.profileSection.photo')}</span>
            <input
              className="catalog-search__input"
              type="url"
              value={photo}
              onChange={(e) => setPhoto(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="ghost-btn" style={{ cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            {t('ui.profile.profileSection.photoUpload')}
          </label>
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
  const [orders, setOrders] = useState(() => getOrders(email))

  useEffect(() => {
    const sync = () => setOrders(getOrders(email))
    window.addEventListener(USER_DATA_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(USER_DATA_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [email])

  if (orders.length === 0) {
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
