import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Product } from '../data/products'
import ProductCard from './ProductCard'

type ProductRecommendationsProps = {
  products: Product[]
  excludeId?: number
  className?: string
}

export default function ProductRecommendations({ products, excludeId, className = '' }: ProductRecommendationsProps) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(4)

  const items = useMemo(() => (
    products
      .filter((product) => product.id !== excludeId)
      .sort((left, right) => {
        if (Number(Boolean(left.isFeatured)) !== Number(Boolean(right.isFeatured))) {
          return Number(Boolean(right.isFeatured)) - Number(Boolean(left.isFeatured))
        }
        return left.id - right.id
      })
  ), [excludeId, products])

  if (items.length === 0) return null

  const shown = items.slice(0, visible)
  const remaining = items.length - shown.length

  return (
    <section className={`recommendations container ${className}`.trim()}>
      <div className="recommendations__head">
        <p className="section-kicker">{t('ui.recommendations.kicker')}</p>
        <h2 className="section-title">{t('ui.recommendations.title')}</h2>
      </div>

      <div className="recommendations__grid">
        {shown.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {remaining > 0 && (
        <button
          type="button"
          className="recommendations__more"
          onClick={() => setVisible((current) => Math.min(current + 8, items.length))}
        >
          {t('ui.recommendations.showMore', { count: Math.min(8, remaining) })}
        </button>
      )}
    </section>
  )
}
