import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

type Stat = { value: string; label: string }
type TimelineItem = { num: string; title: string; text: string }
type ValueItem = { num: string; title: string; text: string }

export default function AboutPage() {
  const { t } = useTranslation()

  const stats = t('about.stats', { returnObjects: true }) as Stat[]
  const timeline = t('about.timeline', { returnObjects: true }) as TimelineItem[]
  const values = t('about.values', { returnObjects: true }) as ValueItem[]

  return (
    <div className="page-shell">
      <div className="page-container">
        <section className="about-hero">
          <div>
            <span className="page-eyebrow">{t('about.eyebrow')}</span>
            <h1 className="about-hero__title">{t('about.title')}</h1>
            <p className="about-hero__sub">{t('about.subtitle')}</p>
            <div className="about-hero__actions">
              <Link to="/catalog" className="cta-btn">{t('about.heroPrimary')}</Link>
              <a
                href="https://t.me/kolman_shop_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="ghost-btn"
                style={{ textDecoration: 'none' }}
              >
                {t('about.heroSecondary')}
              </a>
            </div>
          </div>

          <div className="about-hero__polaroid">
            <span className="about-hero__polaroid-tag">{t('about.polaroidTag')}</span>
            <h2 className="about-hero__polaroid-title">{t('about.polaroidTitle')}</h2>
          </div>
        </section>

        <section className="about-stats" aria-label={t('about.eyebrow')}>
          {stats.map((s) => (
            <div key={s.label} className="about-stat">
              <div className="about-stat__value">{s.value}</div>
              <div className="about-stat__label">{s.label}</div>
            </div>
          ))}
        </section>

        <section className="about-story">
          <div className="about-story__text">
            <p className="section-block-title">{t('about.catalogLabel')}</p>
            <h2 className="about-story__title">{t('about.storyTitle')}</h2>
            <p className="about-story__body">{t('about.storyText')}</p>
          </div>

          <div className="about-timeline">
            {timeline.map((item) => (
              <article key={item.num} className="about-timeline__row">
                <div className="about-timeline__num">{item.num}</div>
                <div>
                  <h3 className="about-timeline__title">{item.title}</h3>
                  <p className="about-timeline__text">{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <p className="section-block-title">{t('about.valuesTitle')}</p>
          <div className="about-values">
            {values.map((v) => (
              <article key={v.num} className="about-value">
                <div className="about-value__num">{v.num}</div>
                <h3 className="about-value__title">{v.title}</h3>
                <p className="about-value__text">{v.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-cta">
          <p className="page-eyebrow">{t('about.contactLabel')}</p>
          <h2 className="about-cta__title">{t('about.contactTitle')}</h2>
          <p className="about-cta__text">{t('about.contactText')}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a
              href="https://www.avito.ru/brands/ff6ecb53876080972365fc0b263271ac"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-btn"
              style={{ textDecoration: 'none' }}
            >
              {t('about.avitoBtn')}
            </a>
            <a
              href="mailto:hello@kolman.shop"
              className="ghost-btn"
              style={{ textDecoration: 'none' }}
            >
              {t('about.emailBtn')}
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
