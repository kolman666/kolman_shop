import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useProducts } from '../hooks/useProducts'
import { usePageContent } from '../hooks/usePageContent'
import ProductCard from '../components/ProductCard'

// Used / second-hand marketplace. Reads admin_products filtered to those
// flagged is_used=true. Visual style intentionally differs from the regular
// catalog so customers know they're shopping pre-owned gear.
//
//   - red accent block around the section title
//   - condition filter chips (any / new-like / good / used / poor)
//   - per-card condition badge + crossed-out original price when set
export default function UsedMarketPage() {
  const { t } = useTranslation()
  const get = usePageContent('used_market', 'usedMarket')
  const { products } = useProducts()
  const [condition, setCondition] = useState<string>('all')
  const [brand, setBrand] = useState<string>('all')
  const [priceBucket, setPriceBucket] = useState<string>('all')

  const usedProducts = useMemo(
    () => products.filter((p) => p.isUsed),
    [products],
  )

  // Distinct conditions present in the data, in a stable display order.
  const conditions = useMemo(() => {
    const order = ['like_new', 'good', 'used', 'poor']
    const present = new Set(usedProducts.map((p) => (p.condition || '').toLowerCase()).filter(Boolean))
    return order.filter((c) => present.has(c))
  }, [usedProducts])

  // Distinct brands present in the used catalog (used only — no point
  // showing a brand chip if nothing in the second-hand list matches).
  const brands = useMemo(() => {
    const set = new Set(usedProducts.map((p) => p.brand).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [usedProducts])

  // Price buckets. We pick reasonable ranges based on the dataset's
  // observed min/max so the chips are useful even on small inventories.
  const priceBuckets = useMemo(() => {
    if (usedProducts.length === 0) return [] as Array<{ id: string; label: string; test: (price: number) => boolean }>
    const prices = usedProducts.map((p) => p.price).filter((p) => p > 0)
    if (prices.length === 0) return []
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const span = max - min
    if (span < 1000) return [] // too narrow to bucket usefully
    const q1 = min + span / 3
    const q2 = min + (span * 2) / 3
    const fmt = (n: number) => `${Math.round(n / 100) * 100}₽`
    return [
      { id: 'low',  label: `до ${fmt(q1)}`,           test: (p: number) => p <= q1 },
      { id: 'mid',  label: `${fmt(q1)}–${fmt(q2)}`,   test: (p: number) => p > q1 && p <= q2 },
      { id: 'high', label: `от ${fmt(q2)}`,           test: (p: number) => p > q2 },
    ]
  }, [usedProducts])

  const filtered = useMemo(() => {
    return usedProducts.filter((p) => {
      if (condition !== 'all' && (p.condition || '').toLowerCase() !== condition) return false
      if (brand !== 'all' && p.brand !== brand) return false
      if (priceBucket !== 'all') {
        const bucket = priceBuckets.find((b) => b.id === priceBucket)
        if (bucket && !bucket.test(p.price)) return false
      }
      return true
    })
  }, [usedProducts, condition, brand, priceBucket, priceBuckets])

  const conditionLabel = (c: string) => t(`ui.usedMarket.conditions.${c}`, { defaultValue: c })

  return (
    <main className="used-page">
      <div className="used-page__container">
        <header className="used-page__hero">
          <span className="used-page__badge">{get('badge')}</span>
          <h1 className="used-page__title">{get('title')}</h1>
          <p className="used-page__lead">{get('lead')}</p>
        </header>

        <div className="used-page__seller-block">
          <h2 className="used-page__seller-title">{get('sellBlockTitle')}</h2>
          <p className="used-page__seller-text">{get('sellBlockText')}</p>
          <Link to="/support" className="used-page__seller-link">
            {get('sellBlockAction')}
          </Link>
        </div>

        {conditions.length > 0 && (
          <div className="used-page__filter-group">
            <span className="used-page__filter-label">{get('byCondition')}</span>
            <div className="used-page__filters" role="tablist" aria-label={get('filterAria')}>
              <button
                type="button"
                role="tab"
                aria-selected={condition === 'all'}
                className={`used-page__filter ${condition === 'all' ? 'used-page__filter--active' : ''}`.trim()}
                onClick={() => setCondition('all')}
              >
                {t('ui.usedMarket.conditions.all')} · {usedProducts.length}
              </button>
              {conditions.map((c) => {
                const count = usedProducts.filter((p) => (p.condition || '').toLowerCase() === c).length
                return (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={condition === c}
                    className={`used-page__filter ${condition === c ? 'used-page__filter--active' : ''}`.trim()}
                    onClick={() => setCondition(c)}
                  >
                    {conditionLabel(c)} · {count}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {brands.length > 1 && (
          <div className="used-page__filter-group">
            <span className="used-page__filter-label">{get('byBrand')}</span>
            <div className="used-page__filters">
              <button
                type="button"
                className={`used-page__filter ${brand === 'all' ? 'used-page__filter--active' : ''}`.trim()}
                onClick={() => setBrand('all')}
              >
                {get('allBrands')}
              </button>
              {brands.map((b) => (
                <button
                  key={b}
                  type="button"
                  className={`used-page__filter ${brand === b ? 'used-page__filter--active' : ''}`.trim()}
                  onClick={() => setBrand(b)}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        {priceBuckets.length > 0 && (
          <div className="used-page__filter-group">
            <span className="used-page__filter-label">{get('byPrice')}</span>
            <div className="used-page__filters">
              <button
                type="button"
                className={`used-page__filter ${priceBucket === 'all' ? 'used-page__filter--active' : ''}`.trim()}
                onClick={() => setPriceBucket('all')}
              >
                {get('allPrices')}
              </button>
              {priceBuckets.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className={`used-page__filter ${priceBucket === b.id ? 'used-page__filter--active' : ''}`.trim()}
                  onClick={() => setPriceBucket(b.id)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {usedProducts.length === 0 ? (
          <p className="used-page__empty">{get('empty')}</p>
        ) : filtered.length === 0 ? (
          <p className="used-page__empty">{get('filteredEmpty')}</p>
        ) : (
          <div className="used-page__grid">
            {filtered.map((p) => (
              <div key={p.id} className="used-page__card-wrap">
                <ProductCard product={p} variant="used" />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
