import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Product } from '../data/products'

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
      <Link className="product-card__cover" to={`/product/${product.id}`} aria-label={title} />
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
        </div>
        <div className="product-card__action-row">
        </div>
      </div>
    </article>
  )
}
