import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Product } from '../data/products'
import { productPath } from '../lib/productRoute'
import { addToCart } from '../lib/cart'

type ProductCardProps = {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const { t } = useTranslation()
  const statusLabel =
    product.availability === 'inStock' ? t('ui.catalog.statusInStock') : t('ui.catalog.statusPreorder')
  const title = product.titleDirect ?? t(product.titleKey)

  return (
    <article className="product-card">
      <Link className="product-card__cover" to={productPath(product)} aria-label={title} />
      <div className="product-card__visual">
        <div className="product-card__badges">
          <span className={`product-card__status product-card__status--${product.availability}`}>{statusLabel}</span>
        </div>
        <img className="product-card__image" src={product.image} alt={title} />
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

        <div className="product-card__footer">
          <div className="product-card__price-block">
            <strong className="product-card__price">{product.price.toLocaleString('ru-RU')} rub</strong>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="add to cart"
            onClick={() => addToCart(product.id, 1)}
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
