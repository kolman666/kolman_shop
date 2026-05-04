import { useTranslation } from 'react-i18next'

export default function PartnershipPage() {
  const { t } = useTranslation()

  return (
    <div className="catalog-shell">
      <div className="catalog-hero" style={{ gridTemplateColumns: '1fr', marginBottom: 24 }}>
        <div>
          <span className="catalog-hero__eyebrow">{t('partnership.eyebrow')}</span>
          <h1 className="catalog-hero__title">{t('partnership.title')}</h1>
          <p className="catalog-hero__note">{t('partnership.subtitle')}</p>
        </div>
      </div>

      <div style={{ width: 'min(1280px, calc(100% - 32px))', margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          <article className="perk-card" style={{ flexDirection: 'column', gap: 20 }}>
            <div className="perk-card__icon" style={{ width: 52, height: 52 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div>
              <h2 className="perk-card__title" style={{ fontSize: 18, marginBottom: 12 }}>{t('partnership.card1.title')}</h2>
              <p className="perk-card__text" style={{ fontSize: 14, lineHeight: 1.75 }}>{t('partnership.card1.text')}</p>
            </div>
          </article>

          <article className="perk-card" style={{ flexDirection: 'column', gap: 20 }}>
            <div className="perk-card__icon" style={{ width: 52, height: 52 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <path d="M3 6h18" /><path d="M16 10a4 4 0 01-8 0" />
              </svg>
            </div>
            <div>
              <h2 className="perk-card__title" style={{ fontSize: 18, marginBottom: 12 }}>{t('partnership.card2.title')}</h2>
              <p className="perk-card__text" style={{ fontSize: 14, lineHeight: 1.75 }}>{t('partnership.card2.text')}</p>
            </div>
          </article>

          <article className="perk-card" style={{ flexDirection: 'column', gap: 20 }}>
            <div className="perk-card__icon" style={{ width: 52, height: 52 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
              </svg>
            </div>
            <div>
              <h2 className="perk-card__title" style={{ fontSize: 18, marginBottom: 12 }}>{t('partnership.card3.title')}</h2>
              <p className="perk-card__text" style={{ fontSize: 14, lineHeight: 1.75 }}>{t('partnership.card3.text')}</p>
            </div>
          </article>
        </div>

        <div
          style={{
            padding: '36px 40px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            background: 'radial-gradient(circle at top right, rgba(225, 29, 29, 0.1), transparent 28%), var(--color-bg-elevated)',
          }}
        >
          <p style={{ margin: '0 0 8px', color: 'var(--color-main)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {t('partnership.ctaLabel')}
          </p>
          <p style={{ margin: '0 0 24px', color: 'var(--color-text-dim)', fontSize: 15, lineHeight: 1.7 }}>
            {t('partnership.ctaText')}
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href="https://t.me/kolman_shop_bot" target="_blank" rel="noopener noreferrer" className="cta-btn" style={{ textDecoration: 'none' }}>
              {t('partnership.telegramBtn')}
            </a>
            <a href="mailto:hello@kolman.shop" className="ghost-btn" style={{ textDecoration: 'none' }}>
              {t('partnership.emailBtn')}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
