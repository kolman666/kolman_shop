import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ProductCard from '../components/ProductCard'
import { useProducts } from '../hooks/useProducts'
import { addToCart, updateQuantity, getCart } from '../lib/cart'
import { variantGroupLabel } from '../lib/variantGroups'
import { FAVORITES_EVENT, isFavorite, toggleFavorite } from '../lib/favorites'
import { AUTH_EVENT, getUser, type User } from '../lib/auth'
import { addReview, getProductReviews, removeReview, USER_DATA_EVENT, type Review } from '../lib/userData'

export default function ProductPage() {
  const { t } = useTranslation()
  const { slug } = useParams()
  const { products, loading } = useProducts()
  const product = products.find((item) => item.slug === slug) ?? products.find((item) => String(item.id) === slug)
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'faq' | 'reviews'>('description')
  const [user, setUser] = useState<User | null>(() => getUser())
  const [fav, setFav] = useState(false)
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewError, setReviewError] = useState('')
  const [activeImageIndex, setActiveImageIndex] = useState(0)
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
    const sync = () => setReviews(getProductReviews(product.id))
    sync()
    window.addEventListener(USER_DATA_EVENT, sync)
    return () => window.removeEventListener(USER_DATA_EVENT, sync)
  }, [product?.id])

  useEffect(() => {
    const sync = () => setUser(getUser())
    window.addEventListener(AUTH_EVENT, sync)
    return () => window.removeEventListener(AUTH_EVENT, sync)
  }, [])

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
  const statusLabel = product.availability === 'inStock' ? t('ui.catalog.statusInStock') : t('ui.catalog.statusPreorder')
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
          <img className="product-page__image" src={gallery[activeImageIndex]} alt={productTitle} />
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
                    <img src={image} alt="" />
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
            </div>
          </div>

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
              {user ? (
                <form
                  className="product-reviews__form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    setReviewError('')
                    const text = reviewText.trim()
                    if (text.length < 3) { setReviewError(t('ui.productPage.reviewTooShort')); return }
                    addReview(user.email, {
                      id: `r-${Date.now()}`,
                      createdAt: Date.now(),
                      productId: product.id,
                      productTitle: productTitle,
                      rating: reviewRating,
                      text,
                      authorName: user.firstName || user.name,
                      authorEmail: user.email,
                    })
                    setReviewText('')
                    setReviewRating(5)
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
                  {reviewError && <p className="product-reviews__error">{reviewError}</p>}
                  <button type="submit" className="cta-btn">{t('ui.productPage.reviewSubmit')}</button>
                </form>
              ) : (
                <p className="product-reviews__login-hint">{t('ui.productPage.reviewLoginHint')}</p>
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
                        <span className="product-reviews__author">— {r.authorName || (r.authorEmail ? r.authorEmail.split('@')[0] : '')}</span>
                        <span className="product-reviews__date">{new Date(r.createdAt).toLocaleDateString()}</span>
                        {user && r.authorEmail === user.email && (
                          <button type="button" className="product-reviews__remove" onClick={() => removeReview(user.email, r.id)}>
                            {t('ui.productPage.reviewDelete')}
                          </button>
                        )}
                      </div>
                      <p className="product-reviews__text">{r.text}</p>
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
    </main>
  )
}
