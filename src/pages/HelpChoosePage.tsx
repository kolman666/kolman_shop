import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function HelpChoosePage() {
  const { t } = useTranslation()

  const cards = [
    {
      key: 'card1',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ),
    },
    {
      key: 'card2',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      ),
    },
    {
      key: 'card3',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
    },
    {
      key: 'card4',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
        </svg>
      ),
    },
  ]

  return (
    <div className="catalog-shell">
      <div className="catalog-hero" style={{ gridTemplateColumns: '1fr', marginBottom: 24 }}>
        <div>
          <span className="catalog-hero__eyebrow">{t('helpChoose.eyebrow')}</span>
          <h1 className="catalog-hero__title">{t('helpChoose.title')}</h1>
          <p className="catalog-hero__note">{t('helpChoose.subtitle')}</p>
        </div>
      </div>

      <div style={{ width: 'min(1280px, calc(100% - 32px))', margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {cards.map(({ key, icon }) => (
            <article key={key} className="perk-card" style={{ flexDirection: 'column', gap: 18 }}>
              <div className="perk-card__icon" style={{ width: 48, height: 48 }}>{icon}</div>
              <div>
                <h2 className="perk-card__title" style={{ fontSize: 17, marginBottom: 10 }}>{t(`helpChoose.${key}.title`)}</h2>
                <p className="perk-card__text" style={{ fontSize: 14, lineHeight: 1.75 }}>{t(`helpChoose.${key}.text`)}</p>
              </div>
            </article>
          ))}
        </div>

        <div
          style={{
            padding: '36px 40px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            background: 'radial-gradient(circle at top right, rgba(225, 29, 29, 0.1), transparent 28%), var(--color-bg-elevated)',
            display: 'grid',
            gap: 20,
          }}
        >
          <div>
            <p style={{ margin: '0 0 8px', color: 'var(--color-main)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {t('helpChoose.ctaTitle')}
            </p>
            <p style={{ margin: 0, color: 'var(--color-text-dim)', fontSize: 15, lineHeight: 1.7 }}>
              {t('helpChoose.ctaText')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="https://t.me/kolman_shop_bot" target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ textDecoration: 'none' }}>
              {t('helpChoose.telegramBtn')}
            </a>
            <Link to="/support" className="ghost-btn">
              {t('helpChoose.supportBtn')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
