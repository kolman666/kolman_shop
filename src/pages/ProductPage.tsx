import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ProductCard from '../components/ProductCard'
import { useProducts } from '../hooks/useProducts'
import { addToCart, updateQuantity, getCart } from '../lib/cart'

export default function ProductPage() {
  const { t } = useTranslation()
  const { id } = useParams()
  const { products } = useProducts()
  const product = products.find((item) => item.id === Number(id))
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'faq'>('description')
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [isAskModalOpen, setIsAskModalOpen] = useState(false)
  const [questionName, setQuestionName] = useState('')
  const [questionContact, setQuestionContact] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [added, setAdded] = useState(false)
  const [qty, setQty] = useState(() => getCart()[String(product?.id)] ?? 0)

  useEffect(() => {
    const sync = () => setQty(getCart()[String(product?.id)] ?? 0)
    window.addEventListener('cart:update', sync)
    return () => window.removeEventListener('cart:update', sync)
  }, [product?.id])

  if (!product) {
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
          <div className="ask-modal__overlay" onClick={() => setIsAskModalOpen(false)} />
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
