import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchSiteContent } from '../lib/siteContent'
import { safeBackgroundImage, safeHref } from '../lib/safeUrl'

export type NewsItem = {
  id: string
  tag?: string
  date?: string
  readMin?: string
  title: string
  excerpt?: string
  image?: string
  url?: string
}

type NewsBlockProps = {
  // Optional override for admin preview — when provided, this list is used
  // verbatim and no fetch is made.
  items?: NewsItem[]
}

export default function NewsBlock({ items: itemsProp }: NewsBlockProps = {}) {
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState<NewsItem[]>(itemsProp ?? [])
  const [offset, setOffset] = useState(0)
  const [maxOffset, setMaxOffset] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (itemsProp) {
      setItems(itemsProp)
      return
    }
    let cancelled = false
    const lng = i18n.language.startsWith('en') ? 'en' : 'ru'
    void (async () => {
      const langSpecific = await fetchSiteContent<NewsItem[]>(`homepage_news_${lng}`)
      if (cancelled) return
      if (!langSpecific.error && langSpecific.data && langSpecific.data.length > 0) {
        setItems(langSpecific.data)
        return
      }
      const generic = await fetchSiteContent<NewsItem[]>('homepage_news')
      if (cancelled) return
      if (!generic.error && generic.data && generic.data.length > 0) {
        setItems(generic.data)
      }
    })()
    return () => { cancelled = true }
  }, [i18n.language, itemsProp])

  // Recalculate max offset whenever items or viewport size change.
  useEffect(() => {
    const recalc = () => {
      const track = trackRef.current
      const wrap = wrapRef.current
      if (!track || !wrap) return
      const max = Math.max(0, track.scrollWidth - wrap.clientWidth)
      setMaxOffset(max)
      setOffset((prev) => Math.min(prev, max))
    }
    recalc()
    window.addEventListener('resize', recalc)
    return () => window.removeEventListener('resize', recalc)
  }, [items])

  const slideBy = (dir: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    const firstCard = track.querySelector<HTMLElement>('.news-card')
    const step = firstCard ? firstCard.offsetWidth + 20 : 540
    setOffset((prev) => {
      const next = prev + dir * step
      if (next < 0) return 0
      if (next > maxOffset) return maxOffset
      return next
    })
  }

  if (items.length === 0) return null

  const canPrev = offset > 0
  const canNext = offset < maxOffset

  return (
    <section className="news-section" aria-labelledby="news-title">
      <div className="news-section__layout">
        <aside className="news-section__intro">
          <span className="page-eyebrow news-section__kicker">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            {t('ui.newsKicker')}
          </span>
          <h2 id="news-title" className="news-section__title">
            {t('ui.newsTitleStart')}<span className="news-section__title-accent">{t('ui.newsTitleAccent')}</span>{t('ui.newsTitleEnd')}
          </h2>
          <p className="news-section__sub">{t('ui.newsSub')}</p>
          <Link to="/catalog" className="news-section__read-all">
            {t('ui.newsReadAll')}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
          {maxOffset > 0 && (
            <div className="news-section__nav">
              <button
                type="button"
                className="news-section__nav-btn"
                onClick={() => slideBy(-1)}
                aria-label="previous"
                disabled={!canPrev}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                className="news-section__nav-btn"
                onClick={() => slideBy(1)}
                aria-label="next"
                disabled={!canNext}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
        </aside>

        <div ref={wrapRef} className="news-track-wrap">
          <div ref={trackRef} className="news-track" style={{ transform: `translateX(-${offset}px)` }}>
            {items.map((item) => {
              const safeUrl = safeHref(item.url) ?? '/catalog'
              const isExternal = /^https?:\/\//i.test(safeUrl)
              const bg = item.image ? safeBackgroundImage(item.image) : null
              return (
                <a
                  key={item.id}
                  href={safeUrl}
                  target={isExternal ? '_blank' : undefined}
                  rel={isExternal ? 'noopener noreferrer' : undefined}
                  className="news-card"
                >
                  <div className="news-card__media">
                    {bg && <img className="news-card__media-img" src={bg} alt="" loading="lazy" />}
                  </div>
                  <div className="news-card__body">
                    <div className="news-card__meta">
                      {item.tag && <span className="news-card__tag">{item.tag}</span>}
                      {item.readMin && (
                        <span className="news-card__read">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" />
                          </svg>
                          {item.readMin}
                        </span>
                      )}
                    </div>
                    <h3 className="news-card__title">{item.title}</h3>
                    {item.excerpt && <p className="news-card__excerpt">{item.excerpt}</p>}
                    <span className="news-card__cta">
                      {t('ui.newsReadMore')}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <path d="M5 12h14M13 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
