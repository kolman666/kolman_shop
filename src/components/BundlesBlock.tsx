import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Product } from '../data/products'
import { fetchSiteContent } from '../lib/siteContent'
import { addToCart } from '../lib/cart'
import { setPromo, validatePromo } from '../lib/promo'
import { productPath } from '../lib/productRoute'

// "Build your setup" bundles. Curated product sets defined in the admin
// (Промокоды → Комплекты, stored in the `bundles` site_content key). Each
// bundle can carry a promo code that auto-applies to the cart on "add set",
// so the discount is enforced server-side at checkout (no client tampering).

type Bundle = {
  title?: string
  subtitle?: string
  productIds?: number[]
  promoCode?: string
  image?: string
}

type Resolved = {
  bundle: Bundle
  items: Product[]
  sum: number
}

export default function BundlesBlock({ products }: { products: Product[] }) {
  const { t } = useTranslation()
  const [bundles, setBundles] = useState<Bundle[] | null>(null)
  const [discounts, setDiscounts] = useState<Record<number, number>>({})
  const [addedIdx, setAddedIdx] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSiteContent<Bundle[]>('bundles').then((r) => {
      if (!cancelled && !r.error && Array.isArray(r.data)) setBundles(r.data)
    })
    return () => { cancelled = true }
  }, [])

  const resolved = useMemo<Resolved[]>(() => {
    if (!bundles) return []
    const byId = new Map(products.map((p) => [p.id, p]))
    return bundles
      .map((bundle) => {
        const items = (bundle.productIds ?? [])
          .map((id) => byId.get(id))
          .filter((p): p is Product => Boolean(p))
        const sum = items.reduce((acc, p) => acc + p.price, 0)
        return { bundle, items, sum }
      })
      .filter((b) => b.items.length >= 2)
  }, [bundles, products])

  // Preview the discount for bundles that carry a promo code (server is the
  // source of truth — same endpoint the cart uses to validate).
  useEffect(() => {
    let cancelled = false
    resolved.forEach((b, idx) => {
      const code = b.bundle.promoCode
      if (!code || b.sum <= 0) return
      void validatePromo(code, b.sum).then((res) => {
        if (!cancelled && res.ok) {
          setDiscounts((prev) => ({ ...prev, [idx]: res.promo.discount }))
        }
      })
    })
    return () => { cancelled = true }
  }, [resolved])

  if (!bundles || resolved.length === 0) return null

  async function handleAdd(b: Resolved, idx: number) {
    for (const p of b.items) addToCart(p.id, 1)
    const code = b.bundle.promoCode
    if (code) {
      const res = await validatePromo(code, b.sum)
      if (res.ok) setPromo(res.promo)
    }
    window.dispatchEvent(new CustomEvent('cart:item-added'))
    window.dispatchEvent(new Event('cart:open'))
    setAddedIdx(idx)
    window.setTimeout(() => setAddedIdx((cur) => (cur === idx ? null : cur)), 1500)
  }

  return (
    <section className="bundles container" aria-labelledby="bundles-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">{t('ui.bundles.kicker', { defaultValue: 'готовые наборы' })}</p>
          <h2 id="bundles-title" className="section-title">{t('ui.bundles.title', { defaultValue: 'Соберите сетап' })}</h2>
        </div>
        <p className="section-note">
          {t('ui.bundles.note', { defaultValue: 'комплекты со скидкой — мышь, коврик, глайды и аксессуары вместе' })}
        </p>
      </div>

      <div className="bundles__grid">
        {resolved.map((b, idx) => {
          const discount = discounts[idx] ?? 0
          const finalPrice = Math.max(0, b.sum - discount)
          return (
            <article key={idx} className="bundle-card">
              {b.bundle.title && <h3 className="bundle-card__title">{b.bundle.title}</h3>}
              {b.bundle.subtitle && <p className="bundle-card__subtitle">{b.bundle.subtitle}</p>}
              <div className="bundle-card__items">
                {b.items.map((p) => (
                  <Link key={p.id} to={productPath(p)} className="bundle-card__item" title={p.titleDirect ?? p.brand}>
                    <img src={p.image} alt={p.titleDirect ?? p.brand} loading="lazy" decoding="async" />
                    <span className="bundle-card__item-name">{p.titleDirect ?? p.brand}</span>
                  </Link>
                ))}
              </div>
              <div className="bundle-card__footer">
                <div className="bundle-card__price">
                  {discount > 0 && <span className="bundle-card__old">{b.sum.toLocaleString('ru-RU')} ₽</span>}
                  <strong>{finalPrice.toLocaleString('ru-RU')} ₽</strong>
                  {discount > 0 && <span className="bundle-card__save">−{discount.toLocaleString('ru-RU')} ₽</span>}
                </div>
                <button type="button" className="cta-btn bundle-card__add" onClick={() => void handleAdd(b, idx)}>
                  {addedIdx === idx ? '✓ добавлено' : t('ui.bundles.add', { defaultValue: 'собрать сетап' })}
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
