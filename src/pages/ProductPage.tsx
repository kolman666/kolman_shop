import { useState, useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ProductCard from '../components/ProductCard'
import { useProducts } from '../hooks/useProducts'
import { addToCart, updateQuantity, getCart } from '../lib/cart'
import { variantGroupLabel } from '../lib/variantGroups'
import { FAVORITES_EVENT, isFavorite, toggleFavorite } from '../lib/favorites'
import { AUTH_EVENT, getUser, type User } from '../lib/auth'
import { getOrders } from '../lib/userData'
import { fetchMyOrders } from '../lib/customerInbox'
import { resizeImageToDataUrl } from '../lib/imageResize'
import PhotoLightbox, { type LightboxState } from '../components/PhotoLightbox'
import { logRecentlyViewed } from '../lib/recentlyViewed'
import RecentlyViewedStrip from '../components/RecentlyViewedStrip'
import {
  createReviewRemote,
  deleteReviewRemote,
  fetchProductReviewsRemote,
  type RemoteReview,
} from '../lib/reviews'

export default function ProductPage() {
  const { t } = useTranslation()
  const { slug } = useParams()
  const [search] = useSearchParams()
  const { products, loading } = useProducts()
  const product = products.find((item) => item.slug === slug) ?? products.find((item) => String(item.id) === slug)
  // Initial tab honours `?review=1` so the "leave a review" link from the
  // profile's delivered-orders list lands the user straight on the reviews
  // tab instead of the default description.
  const wantsReview = search.get('review') === '1'
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'faq' | 'reviews'>(wantsReview ? 'reviews' : 'description')
  const [user, setUser] = useState<User | null>(() => getUser())
  const [fav, setFav] = useState(false)
  const [reviews, setReviews] = useState<RemoteReview[]>([])
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewError, setReviewError] = useState('')
  const [reviewPhotos, setReviewPhotos] = useState<string[]>([])
  const [reviewUploading, setReviewUploading] = useState(false)
  // Tracks whether the logged-in user has ever purchased this product —
  // we only allow them to leave a review after a real purchase.
  const [hasPurchased, setHasPurchased] = useState(false)
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)
  const [isAskModalOpen, setIsAskModalOpen] = useState(false)
  const [questionName, setQuestionName] = useState('')
  const [questionContact, setQuestionContact] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [added, setAdded] = useState(false)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [qty, setQty] = useState(() => getCart()[String(product?.id)] ?? 0)

  useEffect(() => {
    const sync = () => setQty(getCart()[String(product?.id)] ?? 0)
    window.addEventListener('cart:update', sync)
    return () => window.removeEventListener('cart:update', sync)
  }, [product?.id])

  useEffect(() => {
    if (!product) return
    const sync = () => setFav(isFavorite(product.id))
    sync()
    window.addEventListener(FAVORITES_EVENT, sync)
    window.addEventListener(AUTH_EVENT, sync)
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync)
      window.removeEventListener(AUTH_EVENT, sync)
    }
  }, [product?.id])

  useEffect(() => {
    if (!product) return
    let cancelled = false
    void fetchProductReviewsRemote(product.id).then((rows) => {
      if (!cancelled) setReviews(rows)
    })
    return () => { cancelled = true }
  }, [product?.id])

  useEffect(() => {
    const sync = () => setUser(getUser())
    window.addEventListener(AUTH_EVENT, sync)
    return () => window.removeEventListener(AUTH_EVENT, sync)
  }, [])

  // Log this product to the "recently viewed" buffer so other pages (and the
  // strip below) can surface it. Only runs when we resolved an actual product.
  useEffect(() => {
    if (product?.slug) logRecentlyViewed(product.slug)
  }, [product?.slug])

  // Re-check purchase status whenever the user or product changes. Looks at
  // both the local order mirror (instant feedback after checkout) and remote
  // orders from /api/orders?my=<email>.
  useEffect(() => {
    if (!user || !product) { setHasPurchased(false); return }
    let cancelled = false
    const productId = product.id
    // Local check is sync — gives instant UI feedback.
    const local = getOrders(user.email).some((o) => o.items.some((it) => it.productId === productId))
    if (local) { setHasPurchased(true); return }
    // Remote check covers orders placed on other devices.
    void fetchMyOrders(user.email).then((rows) => {
      if (cancelled) return
      const found = rows.some((o) => (o.items ?? []).some((it) => it.id === productId))
      setHasPurchased(found)
    })
    return () => { cancelled = true }
  }, [user, product?.id])

  useEffect(() => {
    const timer = window.setTimeout(() => {
    if (!product?.variantGroups?.length) {
      setSelectedVariants({})
      return
    }
    const defaults: Record<string, string> = {}
    for (const group of product.variantGroups) {
      const groupKey = group.key || group.name || ''
      if (!groupKey) continue
      defaults[groupKey] = group.options[0] ?? ''
    }
    setSelectedVariants(defaults)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [product?.id, product?.variantGroups])

  if (!product) {
    if (loading) {
      return <main className="product-page product-page--missing container" />
    }
    return (
      <main className="product-page product-page--missing container">
        <p className="product-page__eyebrow">{t('ui.productPage.overview')}</p>
        <h1 className="product-page__title">{t('ui.productPage.notFound')}</h1>
        <p className="product-page__lead">{t('ui.productPage.notFoundText')}</p>
        <Link className="product-page__back" to="/catalog">
          {t('ui.productPage.back')}
        </Link>
      </main>
    )
  }

  const relatedProducts = products.filter((item) => item.id !== product.id && item.categoryKey === product.categoryKey).slice(0, 2)
  // Unified availability check: explicit quantity=0 overrides the
  // `availability` flag so "in stock + 0 шт" no longer renders as "в наличии".
  const isOutOfStock = typeof product.quantity === 'number' && product.quantity === 0
  const statusLabel = isOutOfStock
    ? t('ui.productPage.statusOutOfStock', { defaultValue: 'нет в наличии' })
    : product.availability === 'inStock'
      ? t('ui.catalog.statusInStock')
      : t('ui.catalog.statusPreorder')
  const gallery = product.gallery && product.gallery.length > 0 ? product.gallery : [product.image]
  const productTitle = product.titleDirect ?? t(product.titleKey)
  const productDescription = product.descriptionDirect ?? t(product.descriptionKey)

  const prevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + gallery.length) % gallery.length)
  }

  const nextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % gallery.length)
  }

  const handleAddToCart = () => {
    addToCart(product.id, 1)
    setAdded(true)
    window.setTimeout(() => setAdded(false), 1500)
  }

  const handleQtyChange = (next: number) => {
    updateQuantity(product.id, next)
  }

  const handleQuestionSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsAskModalOpen(false)
    setQuestionName('')
    setQuestionContact('')
    setQuestionText('')
  }

  return (
    <main className="product-page">
      <section className="product-page__hero container">
        <div className="product-page__media">
          <img className="product-page__image" src={gallery[activeImageIndex]} alt={productTitle} loading="eager" decoding="async" />
          <div className="product-page__glow" />
          {gallery.length > 1 && (
            <>
              <button type="button" className="product-page__media-nav product-page__media-nav--prev" onClick={prevImage} aria-label="previous image">
                {'<'}
              </button>
              <button type="button" className="product-page__media-nav product-page__media-nav--next" onClick={nextImage} aria-label="next image">
                {'>'}
              </button>
              <div className="product-page__thumbs">
                {gallery.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    className={`product-page__thumb ${index === activeImageIndex ? 'active' : ''}`}
                    onClick={() => setActiveImageIndex(index)}
                    aria-label={`open image ${index + 1}`}
                  >
                    <img src={image} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="product-page__content">
          <Link className="product-page__back" to="/catalog">
            {t('ui.productPage.back')}
          </Link>

          <p className="product-page__eyebrow">{t('ui.productPage.overview')}</p>
          <h1 className="product-page__title">{productTitle}</h1>

          {reviews.length > 0 && (() => {
            // Compact aggregate rating badge — gives shoppers an at-a-glance
            // signal before they scroll to read individual reviews.
            const avg = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
            return (
              <button
                type="button"
                className="product-page__rating"
                onClick={() => setActiveTab('reviews')}
                title={t('ui.productPage.ratingTooltip')}
              >
                <span className="product-page__rating-stars" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={n <= Math.round(avg) ? 'star star--filled' : 'star'}>★</span>
                  ))}
                </span>
                <span className="product-page__rating-value">{avg.toFixed(1)}</span>
                <span className="product-page__rating-count">
                  · {reviews.length}&nbsp;{t('ui.productPage.reviewsCount', { count: reviews.length })}
                </span>
              </button>
            )
          })()}

          <p className="product-page__lead">{productDescription}</p>

          <div className="product-page__meta-grid">
            <div className="product-page__meta-card">
              <span className="product-page__meta-label">{t('ui.productPage.brandLabel')}</span>
              <strong className="product-page__meta-value">{product.brand}</strong>
            </div>
            <div className="product-page__meta-card">
              <span className="product-page__meta-label">{t('ui.productPage.categoryLabel')}</span>
              <strong className="product-page__meta-value">{t(product.categoryKey)}</strong>
            </div>
            <div className="product-page__meta-card">
              <span className="product-page__meta-label">{t('ui.productPage.statusLabel')}</span>
              <strong className="product-page__meta-value">{statusLabel}</strong>
              {/* "Осталось N шт" — only when there's a low cap. We don't
                * render a separate "нет в наличии" badge anymore because the
                * status label above already reflects OOS via `isOutOfStock`. */}
              {typeof product.quantity === 'number' && product.quantity > 0 && product.quantity <= 5 && (
                <span className="product-page__stock-badge product-page__stock-badge--low">
                  осталось {product.quantity} шт
                </span>
              )}
            </div>
          </div>

          {/* Notify-me CTA: visible when the item is preorder OR out of stock.
            * Pre-fills the support form via /api/inquiries (category: product)
            * so the admin sees the request in their normal inbox. */}
          {(product.availability === 'preorder' || product.quantity === 0) && user && (
            <NotifyMeButton productTitle={product.titleDirect ?? t(product.titleKey)} email={user.email} />
          )}

          {product.specs && product.specs.length > 0 && (
            <div className="product-page__specs-block">
              <h2 className="product-page__section-title">{t('ui.productPage.specsTitle')}</h2>
              <div className="product-page__specs">
                {product.specs.map((spec) => (
                  <span key={spec} className="product-page__spec">
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}

          {product.variantGroups && product.variantGroups.length > 0 && (
            <div className="product-page__specs-block">
              <h2 className="product-page__section-title">Вариативности</h2>
              <div className="admin__two-col">
                {product.variantGroups.map((group) => (
                  <label key={group.key || group.name} className="admin__field">
                    <span className="admin__label">{group.label || variantGroupLabel(group.key || group.name || '')}</span>
                    <select
                      className="admin__select"
                      value={selectedVariants[group.key || group.name || ''] ?? ''}
                      onChange={(e) => setSelectedVariants((prev) => ({ ...prev, [group.key || group.name || '']: e.target.value }))}
                    >
                      {group.options.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="product-page__footer">
            <div className="product-page__price-wrap">
              <span className="product-page__price-label">RUB</span>
              <strong className="product-page__price">{product.price.toLocaleString('ru-RU')}</strong>
            </div>

            <div className="product-page__actions">
              {qty > 0 ? (
                <div className="product-page__cart-control">
                  <button
                    type="button"
                    className="product-page__cta product-page__cta--compact"
                    onClick={handleAddToCart}
                    aria-label="в корзине"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                      <path d="M3 6h18" />
                      <path d="M16 10a4 4 0 01-8 0" />
                    </svg>
                  </button>
                  <div className="product-page__qty-row">
                    <button type="button" className="product-page__qty-btn" onClick={() => handleQtyChange(qty - 1)}>−</button>
                    <span className="product-page__qty-num">{qty}</span>
                    <button type="button" className="product-page__qty-btn" onClick={() => handleQtyChange(qty + 1)}>+</button>
                  </div>
                </div>
              ) : (
                <button type="button" className="product-page__cta" onClick={handleAddToCart}>
                  {t('ui.productPage.addToCart')}
                </button>
              )}
              <button type="button" className="product-page__ghost" onClick={() => setIsAskModalOpen(true)}>
                {t('ui.productPage.askQuestion')}
              </button>
              <button
                type="button"
                className={`product-page__fav ${fav ? 'product-page__fav--active' : ''}`.trim()}
                onClick={() => { toggleFavorite(product.id); setFav(isFavorite(product.id)) }}
                aria-label={fav ? 'remove from favorites' : 'add to favorites'}
                title={fav ? 'В избранном' : 'В избранное'}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            </div>
            <span className={`product-page__toast${added ? ' product-page__toast--visible' : ''}`}>{t('ui.productPage.addedToCart')}</span>
          </div>
        </div>
      </section>

      <section className="product-page__tabs container">
        <div className="product-page__tabs-head">
          <button
            type="button"
            className={`product-page__tab ${activeTab === 'description' ? 'active' : ''}`}
            onClick={() => setActiveTab('description')}
          >
            {t('ui.productPage.tabDescription')}
          </button>
          <button
            type="button"
            className={`product-page__tab ${activeTab === 'specs' ? 'active' : ''}`}
            onClick={() => setActiveTab('specs')}
          >
            {t('ui.productPage.tabSpecs')}
          </button>
          <button
            type="button"
            className={`product-page__tab ${activeTab === 'faq' ? 'active' : ''}`}
            onClick={() => setActiveTab('faq')}
          >
            {t('ui.productPage.tabFaq')}
          </button>
          <button
            type="button"
            className={`product-page__tab ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => setActiveTab('reviews')}
          >
            {t('ui.productPage.tabReviews')} {reviews.length > 0 ? `(${reviews.length})` : ''}
          </button>
        </div>

        <div className="product-page__tabs-body">
          {activeTab === 'description' && <p className="product-page__tab-text">{productDescription}</p>}

          {activeTab === 'specs' && (
            <div className="product-page__tab-specs">
              {(product.specs ?? []).map((spec) => (
                <div key={spec} className="product-page__tab-spec-row">
                  <span>{spec}</span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'faq' && (
            <div className="product-page__faq">
              <article>
                <h3>{t('ui.productPage.faqQ1')}</h3>
                <p>{t('ui.productPage.faqA1')}</p>
              </article>
              <article>
                <h3>{t('ui.productPage.faqQ2')}</h3>
                <p>{t('ui.productPage.faqA2')}</p>
              </article>
              <article>
                <h3>{t('ui.productPage.faqQ3')}</h3>
                <p>{t('ui.productPage.faqA3')}</p>
              </article>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="product-reviews">
              {user && hasPurchased ? (
                <form
                  className="product-reviews__form"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setReviewError('')
                    const text = reviewText.trim()
                    if (text.length < 3) { setReviewError(t('ui.productPage.reviewTooShort')); return }
                    try {
                      const created = await createReviewRemote({
                        productId: product.id,
                        email: user.email,
                        rating: reviewRating,
                        text,
                        authorName: user.firstName || user.name,
                        photos: reviewPhotos,
                      })
                      // Optimistic insert at the top of the list.
                      setReviews((prev) => [created, ...prev])
                      setReviewText('')
                      setReviewRating(5)
                      setReviewPhotos([])
                    } catch (err) {
                      const raw = err instanceof Error ? err.message : 'failed'
                      if (/table_not_found/.test(raw)) {
                        setReviewError(t('ui.productPage.reviewBackendMissing'))
                      } else {
                        setReviewError(raw)
                      }
                    }
                  }}
                >
                  <div className="product-reviews__form-row">
                    <div className="product-reviews__stars" role="radiogroup" aria-label="rating">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          role="radio"
                          aria-checked={reviewRating === n}
                          onClick={() => setReviewRating(n)}
                          className={`product-reviews__star ${n <= reviewRating ? 'product-reviews__star--filled' : ''}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <span className="product-reviews__author">— {user.firstName || user.name}</span>
                  </div>
                  <textarea
                    className="product-reviews__input"
                    rows={3}
                    placeholder={t('ui.productPage.reviewPlaceholder')}
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                  />

                  {/* Photos uploader. Resizes each to ~1024px JPEG before
                      stashing as a data URL so localStorage stays bounded.
                      Capped at 6 photos per review. */}
                  <div className="product-reviews__photos">
                    {reviewPhotos.map((src, i) => (
                      <div key={i} className="product-reviews__photo">
                        <img src={src} alt="" loading="lazy" decoding="async" />
                        <button
                          type="button"
                          className="product-reviews__photo-remove"
                          onClick={() => setReviewPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                          aria-label="remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {reviewPhotos.length < 6 && (
                      <label className={`product-reviews__photo-add ${reviewUploading ? 'product-reviews__photo-add--busy' : ''}`.trim()}>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          style={{ display: 'none' }}
                          onChange={async (e) => {
                            const files = Array.from(e.target.files ?? [])
                            if (files.length === 0) return
                            setReviewUploading(true)
                            try {
                              const slots = 6 - reviewPhotos.length
                              const accepted = files.slice(0, slots)
                              const out: string[] = []
                              for (const f of accepted) {
                                if (f.size > 12 * 1024 * 1024) continue
                                try {
                                  out.push(await resizeImageToDataUrl(f, { maxSize: 1024, quality: 0.82, mimeType: 'image/jpeg' }))
                                } catch { /* skip unreadable */ }
                              }
                              if (out.length > 0) setReviewPhotos((prev) => [...prev, ...out])
                            } finally {
                              setReviewUploading(false)
                            }
                            e.target.value = ''
                          }}
                        />
                        {reviewUploading ? '...' : `+ ${t('ui.productPage.reviewAddPhoto')}`}
                      </label>
                    )}
                  </div>

                  {reviewError && <p className="product-reviews__error">{reviewError}</p>}
                  <button type="submit" className="cta-btn" disabled={reviewUploading}>{t('ui.productPage.reviewSubmit')}</button>
                </form>
              ) : !user ? (
                <p className="product-reviews__login-hint">{t('ui.productPage.reviewLoginHint')}</p>
              ) : (
                <p className="product-reviews__login-hint">{t('ui.productPage.reviewPurchaseHint')}</p>
              )}

              {reviews.length === 0 ? (
                <p className="product-reviews__empty">{t('ui.productPage.reviewEmpty')}</p>
              ) : (
                <ul className="product-reviews__list">
                  {reviews.map((r) => (
                    <li key={r.id} className="product-reviews__item">
                      <div className="product-reviews__head">
                        <div className="product-reviews__stars">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} className={`product-reviews__star ${n <= r.rating ? 'product-reviews__star--filled' : ''}`}>★</span>
                          ))}
                        </div>
                        <span className="product-reviews__author">— {r.author_name || (r.author_email ? r.author_email.split('@')[0] : '')}</span>
                        <span className="product-reviews__date">{new Date(r.created_at).toLocaleDateString()}</span>
                        {user && r.author_email === user.email && (
                          <button
                            type="button"
                            className="product-reviews__remove"
                            onClick={async () => {
                              try {
                                await deleteReviewRemote(r.id, user.email)
                                setReviews((prev) => prev.filter((x) => x.id !== r.id))
                              } catch (err) {
                                setReviewError(err instanceof Error ? err.message : 'failed')
                              }
                            }}
                          >
                            {t('ui.productPage.reviewDelete')}
                          </button>
                        )}
                      </div>
                      <p className="product-reviews__text">{r.text}</p>
                      {r.photos && r.photos.length > 0 && (
                        <div className="product-reviews__photos product-reviews__photos--shown">
                          {r.photos.map((src, i) => (
                            <button
                              key={i}
                              type="button"
                              className="product-reviews__photo product-reviews__photo--shown"
                              onClick={() => setLightbox({ images: r.photos ?? [], index: i })}
                              aria-label="открыть фото"
                            >
                              <img src={src} alt="" loading="lazy" />
                            </button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      {relatedProducts.length > 0 && (
        <section className="product-page__related container">
          <div className="product-page__related-head">
            <p className="product-page__eyebrow">{t('ui.catalog.eyebrow')}</p>
            <h2 className="product-page__related-title">{t('ui.productPage.relatedTitle')}</h2>
          </div>

          <div className="catalog-grid">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}

      {/* Homepage-style `ProductRecommendations` removed here — `product-page__related`
        * above already shows "вам может понравиться". Keeping both produced two
        * almost-identical sections on every product page. */}

      {isAskModalOpen && (
        <div className="ask-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="ask-modal__overlay"
            onClick={() => setIsAskModalOpen(false)}
            aria-label="close question form"
          />
          <div className="ask-modal__body">
            <h2>{t('ui.productPage.askModalTitle')}</h2>
            <form className="ask-modal__form" onSubmit={handleQuestionSubmit}>
              <label>
                <span>{t('ui.productPage.askName')}</span>
                <input value={questionName} onChange={(event) => setQuestionName(event.target.value)} required />
              </label>
              <label>
                <span>{t('ui.productPage.askContact')}</span>
                <input value={questionContact} onChange={(event) => setQuestionContact(event.target.value)} required />
              </label>
              <label>
                <span>{t('ui.productPage.askMessage')}</span>
                <textarea value={questionText} onChange={(event) => setQuestionText(event.target.value)} rows={4} required />
              </label>
              <div className="ask-modal__actions">
                <button type="button" className="ask-modal__cancel" onClick={() => setIsAskModalOpen(false)}>
                  {t('ui.productPage.askCancel')}
                </button>
                <button type="submit" className="ask-modal__submit">
                  {t('ui.productPage.askSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RecentlyViewedStrip excludeSlug={product.slug} />

      <PhotoLightbox
        state={lightbox}
        onClose={() => setLightbox(null)}
        onChange={setLightbox}
      />
    </main>
  )
}

// Notify-me button: when a product is out of stock or preorder, lets a
// logged-in user file a "ping me when it's back" request. The request is
// stored as a normal inquiry (category: 'product') so the admin sees it in
// the existing inbox without any new schema.
function NotifyMeButton({ productTitle, email }: { productTitle: string; email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [err, setErr] = useState('')

  async function ping() {
    setState('sending')
    setErr('')
    try {
      const r = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'product',
          name: '',
          contact: email,
          message: `Сообщите когда появится: «${productTitle}» (запрос с карточки товара)`,
        }),
      })
      if (!r.ok) throw new Error(`${r.status}`)
      setState('done')
    } catch (e) {
      setState('idle')
      setErr(e instanceof Error ? e.message : 'failed')
    }
  }

  if (state === 'done') {
    return (
      <p className="notify-me-done">
        ✓ Уведомим на {email}, как только товар появится.
      </p>
    )
  }
  return (
    <div className="notify-me">
      <button
        type="button"
        className="ghost-btn"
        onClick={() => void ping()}
        disabled={state === 'sending'}
      >
        {state === 'sending' ? 'отправляем…' : '🔔 сообщить когда появится'}
      </button>
      {err && <span className="notify-me__err">{err}</span>}
    </div>
  )
}
