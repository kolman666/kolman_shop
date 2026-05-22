import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchSiteContent } from '../lib/siteContent'
import { safeBackgroundImage, safeHref } from '../lib/safeUrl'
import { useProducts } from '../hooks/useProducts'
import ProductCard from '../components/ProductCard'

// Shape of a brand-detail page stored at `brand_data_<slug>_<lang>`. All
// fields are optional — the page degrades gracefully when admin hasn't filled
// everything in.
type BrandPageData = {
  name?: string
  tagline?: string
  description?: string
  banner?: string
  logo?: string
  website?: string
  brandFilter?: string // value to filter products by (defaults to slug)
  highlights?: Array<{ title: string; text: string }>
}

export default function BrandPage() {
  const { slug } = useParams()
  const { t, i18n } = useTranslation()
  const [data, setData] = useState<BrandPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const { products } = useProducts()

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setLoading(true)
    const lng = i18n.language.startsWith('en') ? 'en' : 'ru'
    void (async () => {
      const res = await fetchSiteContent<BrandPageData>(`brand_data_${slug}_${lng}`)
      if (!cancelled && res.data) {
        setData(res.data)
        setLoading(false)
        return
      }
      // EN fallback when admin only filled in RU (or vice versa).
      if (lng !== 'en') {
        const fallback = await fetchSiteContent<BrandPageData>(`brand_data_${slug}_en`)
        if (!cancelled && fallback.data) {
          setData(fallback.data)
          setLoading(false)
          return
        }
      }
      if (!cancelled) {
        setData({})
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [slug, i18n.language])

  // Resolve products that belong to this brand. Admins can override the
  // filter string in `brandFilter`; default to the slug.
  const brandFilter = (data?.brandFilter || slug || '').toLowerCase()
  const brandProducts = brandFilter
    ? products.filter((p) => p.brand.toLowerCase().includes(brandFilter))
    : []

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-container"><p style={{ color: 'var(--color-text-dim)' }}>{t('ui.brandLoading')}</p></div>
      </main>
    )
  }

  const bannerUrl = data?.banner ? safeBackgroundImage(data.banner) : null
  const websiteUrl = safeHref(data?.website ?? '')
  const isExternalSite = websiteUrl && /^https?:\/\//i.test(websiteUrl)

  return (
    <main className="page-shell">
      <article className="brand-page">
        <header
          className="brand-page__hero"
          style={bannerUrl ? { backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url("${bannerUrl}")` } : undefined}
        >
          <div className="brand-page__hero-inner">
            <Link to="/" className="brand-page__back">← {t('ui.toHome')}</Link>
            {data?.logo && <img className="brand-page__logo" src={data.logo} alt={data?.name ?? slug} />}
            <h1 className="brand-page__title">{data?.name || slug}</h1>
            {data?.tagline && <p className="brand-page__tagline">{data.tagline}</p>}
            {websiteUrl && isExternalSite && (
              <a href={websiteUrl} target="_blank" rel="noopener noreferrer" className="ghost-btn brand-page__website" style={{ textDecoration: 'none' }}>
                {t('ui.brandWebsite')} →
              </a>
            )}
          </div>
        </header>

        {data?.description && (
          <section className="brand-page__about">
            {data.description.split(/\n{2,}/).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </section>
        )}

        {data?.highlights && data.highlights.length > 0 && (
          <section className="brand-page__highlights">
            {data.highlights.map((h, i) => (
              <article key={i} className="perk-card" style={{ flexDirection: 'column' }}>
                <h3 className="perk-card__title">{h.title}</h3>
                <p className="perk-card__text">{h.text}</p>
              </article>
            ))}
          </section>
        )}

        <section className="brand-page__catalog">
          <header className="section-heading">
            <div>
              <p className="section-kicker">{t('ui.brandProductsKicker')}</p>
              <h2 className="section-title">{t('ui.brandProductsTitle', { brand: data?.name || slug })}</h2>
            </div>
            <Link to={`/catalog?brand=${encodeURIComponent(data?.name || slug || '')}`} className="ghost-btn" style={{ textDecoration: 'none' }}>
              {t('ui.brandSeeAll')} →
            </Link>
          </header>
          {brandProducts.length === 0 ? (
            <p style={{ color: 'var(--color-text-dim)' }}>{t('ui.brandNoProducts')}</p>
          ) : (
            <div className="catalog-grid">
              {brandProducts.slice(0, 6).map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </article>
    </main>
  )
}
