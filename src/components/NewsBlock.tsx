import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchSiteContent } from '../lib/siteContent'
import { safeBackgroundImage } from '../lib/safeUrl'

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

const FALLBACK_NEWS: NewsItem[] = [
  {
    id: 'fenrir',
    tag: 'обзоры',
    readMin: '5 мин чтения',
    title: 'удивительная малютка G-Wolves Fenrir Asym',
    excerpt: 'сегодня мы подробно разберем игровую мышь G-Wolves Fenrir Asym. она была создана строго для одной цели — использования пальцевым хватом (fingertip grip). мы изучили её со всех сторон.',
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=1200&q=80',
    url: '/catalog',
  },
  {
    id: 'zywoo',
    tag: 'обзоры',
    readMin: '4 мин чтения',
    title: 'ZywOo x Pulsar: «оружие избранного»',
    excerpt: 'компания pulsar совместно с главной звездой CS2 матье «zywoo» эрбо выпустили именную мышь. это не просто девайс с логотипом, а спроектированный под профессиональную игру инструмент.',
    image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=1200&q=80',
    url: '/catalog',
  },
  {
    id: 'modding',
    tag: 'гайды',
    readMin: '7 мин чтения',
    title: 'смазка свитчей: с чего начать новичку',
    excerpt: 'выбираем смазку под свой кейкорд, разбираем порядок работ и показываем разницу до и после на тесте популярных свитчей.',
    image: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=1200&q=80',
    url: '/modding',
  },
]

export default function NewsBlock() {
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState<NewsItem[]>(FALLBACK_NEWS)
  const [offset, setOffset] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
  }, [i18n.language])

  const slideBy = (dir: 1 | -1) => {
    const track = trackRef.current
    const wrap = wrapRef.current
    if (!track || !wrap) return
    const firstCard = track.querySelector<HTMLElement>('.news-card')
    const step = firstCard ? firstCard.offsetWidth + 18 : 540
    const maxOffset = Math.max(0, track.scrollWidth - wrap.clientWidth)
    setOffset((prev) => {
      const next = prev + dir * step
      if (next < 0) return 0
      if (next > maxOffset) return maxOffset
      return next
    })
  }

  if (items.length === 0) return null

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
          <div className="news-section__nav">
            <button type="button" className="news-section__nav-btn" onClick={() => slideBy(-1)} aria-label="previous">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button type="button" className="news-section__nav-btn" onClick={() => slideBy(1)} aria-label="next">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        </aside>

        <div ref={wrapRef} className="news-track-wrap">
          <div ref={trackRef} className="news-track" style={{ transform: `translateX(-${offset}px)` }}>
            {items.map((item) => {
              const url = item.url ?? '/catalog'
              const isExternal = /^https?:\/\//i.test(url)
              const bg = item.image ? safeBackgroundImage(item.image) : null
              return (
                <a
                  key={item.id}
                  href={url}
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
