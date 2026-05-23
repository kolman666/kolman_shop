// Horizontal strip of recently viewed products. Self-contained — reads slugs
// from localStorage, joins with the live products list, renders ProductCards.
// Hidden when there's nothing to show (first visit, single-product session).
//
// Pass `excludeSlug` on the product page so the current page isn't echoed
// back to itself in the strip.

import { useEffect, useState, useMemo } from 'react'
import { useProducts } from '../hooks/useProducts'
import { getRecentlyViewed, RECENTLY_VIEWED_EVENT } from '../lib/recentlyViewed'
import ProductCard from './ProductCard'

type Props = {
  excludeSlug?: string
  limit?: number
  title?: string
}

export default function RecentlyViewedStrip({ excludeSlug, limit = 8, title = 'недавно смотрел' }: Props) {
  const { products } = useProducts()
  const [slugs, setSlugs] = useState<string[]>(() => getRecentlyViewed())

  useEffect(() => {
    const sync = () => setSlugs(getRecentlyViewed())
    window.addEventListener(RECENTLY_VIEWED_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(RECENTLY_VIEWED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const items = useMemo(() => {
    const bySlug = new Map(products.map((p) => [p.slug, p]))
    return slugs
      .filter((s) => s !== excludeSlug)
      .map((s) => bySlug.get(s))
      .filter(Boolean)
      .slice(0, limit) as ReturnType<typeof Array.prototype.filter<typeof products[number]>>
  }, [slugs, products, excludeSlug, limit])

  if (items.length === 0) return null

  return (
    <section className="recently-viewed container">
      <header className="recently-viewed__head">
        <h2 className="recently-viewed__title">{title}</h2>
      </header>
      <div className="recently-viewed__strip">
        {items.map((p) => (
          <div key={p.id} className="recently-viewed__item">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  )
}
