import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { fetchSiteContent } from '../lib/siteContent'
import { safeBackgroundImage, safeHref } from '../lib/safeUrl'
import type { NewsItem } from '../components/NewsBlock'
import { renderBBCode } from '../lib/bbcode'

type NewsItemFull = NewsItem & {
  body?: string
}

export default function NewsArticlePage() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const [item, setItem] = useState<NewsItemFull | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const lng = i18n.language.startsWith('en') ? 'en' : 'ru'
    void (async () => {
      const langSpecific = await fetchSiteContent<NewsItemFull[]>(`homepage_news_${lng}`)
      let items = langSpecific.data ?? []
      if (items.length === 0) {
        const generic = await fetchSiteContent<NewsItemFull[]>('homepage_news')
        items = generic.data ?? []
      }
      if (cancelled) return
      const found = items.find((n) => n.id === id) ?? null
      setItem(found)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, i18n.language])

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-container">
          <p style={{ color: 'var(--color-text-dim)' }}>{t('ui.newsLoading')}</p>
        </div>
      </main>
    )
  }

  if (!item) {
    return (
      <main className="page-shell">
        <div className="page-container">
          <span className="page-eyebrow">{t('ui.newsKicker')}</span>
          <h1 className="news-article__title" style={{ marginTop: 6 }}>{t('ui.newsNotFoundTitle')}</h1>
          <p style={{ color: 'var(--color-text-dim)', marginBottom: 24 }}>{t('ui.newsNotFoundText')}</p>
          <Link to="/" className="cta-btn" style={{ textDecoration: 'none', width: 'fit-content' }}>
            {t('ui.toHome')}
          </Link>
        </div>
      </main>
    )
  }

  const img = item.image ? safeBackgroundImage(item.image) : null
  const externalUrl = safeHref(item.url)
  const isExternalSource = externalUrl && /^https?:\/\//i.test(externalUrl)

  return (
    <main className="page-shell">
      <article className="news-article">
        <header className="news-article__head">
          <div className="news-article__meta">
            {item.tag && <span className="news-card__tag">{item.tag}</span>}
            {item.readMin && <span className="news-card__read">{item.readMin}</span>}
            {item.date && <span className="news-card__read">{item.date}</span>}
          </div>
          <h1 className="news-article__title">{item.title}</h1>
          {item.excerpt && <p className="news-article__excerpt">{item.excerpt}</p>}
        </header>

        {img && (
          <div className="news-article__media">
            <img src={img} alt="" loading="eager" />
          </div>
        )}

        {item.body ? (
          <div className="news-article__body">
            {/* Body uses lightweight BBCode (see lib/bbcode.ts). Old plain-text
              * articles without any tags continue to render as paragraphs split
              * by blank lines — that path is preserved inside the parser. */}
            {renderBBCode(item.body)}
          </div>
        ) : (
          <div className="news-article__body">
            <p style={{ color: 'var(--color-text-dim)' }}>{t('ui.newsNoBody')}</p>
          </div>
        )}

        {isExternalSource && (
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ghost-btn"
            style={{ textDecoration: 'none', width: 'fit-content' }}
          >
            {t('ui.newsExternalSource')} →
          </a>
        )}

        <Link to="/" className="news-article__back">
          ← {t('ui.toHome')}
        </Link>
      </article>
    </main>
  )
}
