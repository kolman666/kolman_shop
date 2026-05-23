import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '../data/products'
import { productPath } from '../lib/productRoute'
import { safeBackgroundImage } from '../lib/safeUrl'

type Props = {
  products: Product[]
  brandSlug: string
  brandLabel: string
  bannerImage?: string
  bannerUrl?: string
  bannerLabel?: string
}

function getVisibleCount() {
  return window.innerWidth <= 720 ? 1 : 4
}

export default function BrandSpotlight({ products, brandSlug, brandLabel, bannerImage, bannerUrl, bannerLabel }: Props) {
  const [offset, setOffset] = useState(0)
  const [visibleCount, setVisibleCount] = useState(getVisibleCount)

  useEffect(() => {
    const update = () => setVisibleCount(getVisibleCount())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const brandProducts = products.filter(
    (p) => p.brand.toLowerCase().replace(/\s+/g, '') === brandSlug.toLowerCase().replace(/\s+/g, '')
  )
  if (brandProducts.length === 0) return null

  const maxOffset = Math.max(0, brandProducts.length - visibleCount)
  const visible = brandProducts.slice(offset, offset + visibleCount)

  const prev = () => setOffset((o) => Math.max(0, o - 1))
  const next = () => setOffset((o) => Math.min(maxOffset, o + 1))

  const bannerTarget = (bannerUrl?.trim() || `/brand/${brandSlug}`).trim()
  const isExternal = /^https?:\/\//i.test(bannerTarget)

  return (
    <section className="bsp">
      <div className="bsp__inner">

        {/* ── Brand name centered ── */}
        <h2 className="bsp__name">{brandLabel}</h2>

        {/* ── Full-width banner ── */}
        <div
          className="bsp__banner"
          style={(() => { const u = safeBackgroundImage(bannerImage); return u ? { backgroundImage: `url("${u}")` } : undefined })()}
        >
          <div className="bsp__banner-overlay" />
          {isExternal ? (
            <a
              href={bannerTarget}
              className="bsp__banner-cta"
              target="_blank"
              rel="noopener noreferrer"
            >
              {bannerLabel ?? 'перейти к бренду →'}
            </a>
          ) : (
            <Link
              to={bannerTarget}
              className="bsp__banner-cta"
            >
              {bannerLabel ?? 'перейти к бренду →'}
            </Link>
          )}
        </div>

        {/* ── Product strip overlapping banner ── */}
        <div className="bsp__strip-outer">
          <button
            type="button"
            className="bsp__arrow bsp__arrow--prev"
            onClick={prev}
            disabled={offset === 0}
            aria-label="previous"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>

          <div className="bsp__strip">
            {visible.map((product) => (
              <Link
                key={product.id}
                to={productPath(product)}
                className="bsp__card"
              >
                <div className="bsp__card-img-wrap">
                  {product.availability === 'inStock' && (
                    <span className="bsp__card-badge">в наличии</span>
                  )}
                  <img
                    className="bsp__card-img"
                    src={product.image}
                    alt={product.titleDirect ?? product.brand}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="bsp__card-body">
                  {product.specs && product.specs.length > 0 && (
                    <p className="bsp__card-category">{product.specs.slice(0, 2).join(' · ')}</p>
                  )}
                  <p className="bsp__card-title">{product.brand} {product.titleDirect}</p>
                  <strong className="bsp__card-price">{product.price.toLocaleString('ru-RU')} ₽</strong>
                </div>
              </Link>
            ))}
          </div>

          <button
            type="button"
            className="bsp__arrow bsp__arrow--next"
            onClick={next}
            disabled={offset >= maxOffset}
            aria-label="next"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

      </div>
    </section>
  )
}
