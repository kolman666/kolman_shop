import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Product } from '../data/products'
import { productPath } from '../lib/productRoute'
import { addToCart } from '../lib/cart'
import { FAVORITES_EVENT, isFavorite, toggleFavorite } from '../lib/favorites'
import { AUTH_EVENT } from '../lib/auth'

type ProductCardProps = {
  product: Product
  variant?: 'default' | 'used'
}

export default function ProductCard({ product, variant = 'default' }: ProductCardProps) {
  const { t } = useTranslation()
  const [isAdded, setIsAdded] = useState(false)
  const [fav, setFav] = useState(() => isFavorite(product.id))
  // Single source of truth: if quantity is explicitly 0, the product is OOS
  // regardless of what the `availability` flag says. Used (second-hand)
  // products treat null/undefined quantity as "one-off" — still in stock.
  const isOutOfStock = typeof product.quantity === 'number' && product.quantity === 0
  const statusLabel = isOutOfStock
    ? t('ui.productPage.statusOutOfStock', { defaultValue: 'нет в наличии' })
    : product.availability === 'inStock'
      ? t('ui.catalog.statusInStock')
      : t('ui.catalog.statusPreorder')
  const statusClass = isOutOfStock ? 'outOfStock' : product.availability
  const title = product.titleDirect ?? t(product.titleKey)
  const isUsedCard = variant === 'used'
  const conditionKey = (product.condition || '').toLowerCase()
  const conditionLabel = conditionKey
    ? t(`ui.usedMarket.conditions.${conditionKey}`, { defaultValue: product.condition })
    : ''
  const discount = typeof product.originalPrice === 'number' && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0

  useEffect(() => {
    const sync = () => setFav(isFavorite(product.id))
    window.addEventListener(FAVORITES_EVENT, sync)
    window.addEventListener(AUTH_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(FAVORITES_EVENT, sync)
      window.removeEventListener(AUTH_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [product.id])

  const handleQuickAdd = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    addToCart(product.id, 1)
    window.dispatchEvent(new CustomEvent('cart:item-added'))
    setIsAdded(true)
    window.setTimeout(() => setIsAdded(false), 260)
  }

  const handleToggleFav = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setFav(toggleFavorite(product.id))
  }

  return (
    <article className={`product-card ${isUsedCard ? 'product-card--used' : ''}`.trim()}>
      <Link className="product-card__cover" to={productPath(product)} aria-label={title} />
      <button
        type="button"
        className={`product-card__fav ${fav ? 'product-card__fav--active' : ''}`.trim()}
        onClick={handleToggleFav}
        aria-label={fav ? 'remove from favorites' : 'add to favorites'}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
      <div className="product-card__visual">
        <div className="product-card__badges">
          <span className={`product-card__status product-card__status--${statusClass}`}>{statusLabel}</span>
        </div>
        <img className="product-card__image" src={product.image} alt={title} loading="lazy" decoding="async" />
      </div>

      <div className="product-card__body">
        <p className="product-card__meta">{product.brand}</p>
        <h3 className="product-card__title">{title}</h3>

        {product.specs && product.specs.length > 0 && (
          <div className="product-card__specs">
            {product.specs.slice(0, 3).map((spec) => (
              <span key={spec} className="product-card__spec">
                {spec}
              </span>
            ))}
          </div>
        )}

        {isUsedCard && (
          <div className="product-card__used-meta">
            {conditionLabel && (
              <span className={`product-card__condition product-card__condition--${conditionKey}`}>
                {conditionLabel}
              </span>
            )}
            {product.defects && (
              <details className="product-card__defects">
                <summary>{t('ui.usedMarket.defectsSummary')}</summary>
                <p>{product.defects}</p>
              </details>
            )}
            {discount > 0 && (
              <div className="product-card__used-price-row">
                <span className="product-card__old-price">{product.originalPrice?.toLocaleString('ru-RU')} rub</span>
                <span className="product-card__discount">-{discount}%</span>
              </div>
            )}
          </div>
        )}

        <div className="product-card__footer">
          <div className="product-card__price-block">
            <strong className="product-card__price">{product.price.toLocaleString('ru-RU')} rub</strong>
          </div>
          <button
            type="button"
            className={`icon-button ${isAdded ? 'icon-button--added' : ''}`}
            aria-label="add to cart"
            onClick={handleQuickAdd}
            style={{ width: 34, height: 34, minWidth: 34 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
          </button>
        </div>
        <div className="product-card__action-row">
        </div>
      </div>
    </article>
  )
}
