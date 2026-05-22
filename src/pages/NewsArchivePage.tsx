import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchSiteContent } from '../lib/siteContent'
import { safeBackgroundImage } from '../lib/safeUrl'
import type { NewsItem } from '../components/NewsBlock'

// Full list of every article. Reachable from the homepage "читать все статьи"
// link on the blog block and from the individual article page back-link.
export default function NewsArchivePage() {
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const lng = i18n.language.startsWith('en') ? 'en' : 'ru'
    void (async () => {
      // Same fallback chain as NewsBlock: language-specific → generic.
      const langSpecific = await fetchSiteContent<NewsItem[]>(`homepage_news_${lng}`)
      let rows = langSpecific.data ?? []
      if (rows.length === 0) {
        const generic = await fetchSiteContent<NewsItem[]>('homepage_news')
        rows = generic.data ?? []
      }
      if (cancelled) return
      setItems(rows)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [i18n.language])

  return (
    <main className="page-shell">
      <div className="page-container">
        <header style={{ display: 'grid', gap: 8 }}>
          <span className="page-eyebrow">{t('ui.newsKicker')}</span>
          <h1 className="news-section__title" style={{ marginTop: 0 }}>
            {t('ui.newsTitleStart')}<span className="news-section__title-accent">{t('ui.newsTitleAccent')}</span>{t('ui.newsTitleEnd')}
          </h1>
          <p className="news-section__sub" style={{ maxWidth: 'none' }}>{t('ui.newsSub')}</p>
        </header>

        {loading ? (
          <p style={{ color: 'var(--color-text-dim)' }}>{t('ui.newsLoading')}</p>
        ) : items.length === 0 ? (
          <p style={{ color: 'var(--color-text-dim)' }}>{t('ui.newsArchiveEmpty')}</p>
        ) : (
          <div className="news-archive">
            {items.map((item) => {
              const href = item.id ? `/news/${encodeURIComponent(item.id)}` : '/catalog'
              const bg = item.image ? safeBackgroundImage(item.image) : null
              return (
                <Link key={item.id} to={href} className="news-card news-archive__card">
                  <div className="news-card__media">
                    {bg && <img className="news-card__media-img" src={bg} alt="" loading="lazy" />}
                  </div>
                  <div className="news-card__body">
                    <div className="news-card__meta">
                      {item.tag && <span className="news-card__tag">{item.tag}</span>}
                      {item.readMin && <span className="news-card__read">{item.readMin}</span>}
                      {item.date && <span className="news-card__read">{item.date}</span>}
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
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
