import { useTranslation } from 'react-i18next'

export default function AboutPage() {
  const { t } = useTranslation()

  return (
    <div className="catalog-shell">
      <div className="catalog-hero" style={{ gridTemplateColumns: '1fr', marginBottom: 24 }}>
        <div>
          <span className="catalog-hero__eyebrow">{t('about.eyebrow')}</span>
          <h1 className="catalog-hero__title">{t('about.title')}</h1>
          <p className="catalog-hero__note">{t('about.subtitle')}</p>
        </div>
      </div>

      <div
        style={{
          width: 'min(1280px, calc(100% - 32px))',
          margin: '0 auto',
          display: 'grid',
          gap: 16,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          <article className="perk-card" style={{ flexDirection: 'column', gap: 20 }}>
            <div className="perk-card__icon" style={{ width: 52, height: 52 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h2 className="perk-card__title" style={{ fontSize: 18, marginBottom: 12 }}>{t('about.card1.title')}</h2>
              <p className="perk-card__text" style={{ fontSize: 14, lineHeight: 1.75 }}>{t('about.card1.text')}</p>
            </div>
          </article>

          <article className="perk-card" style={{ flexDirection: 'column', gap: 20 }}>
            <div className="perk-card__icon" style={{ width: 52, height: 52 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="1" y="3" width="15" height="13" rx="2" />
                <path d="M16 8h4l3 5v3h-7V8z" />
                <circle cx="5.5" cy="18.5" r="2.5" />
                <circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
            </div>
            <div>
              <h2 className="perk-card__title" style={{ fontSize: 18, marginBottom: 12 }}>{t('about.card2.title')}</h2>
              <p className="perk-card__text" style={{ fontSize: 14, lineHeight: 1.75 }}>{t('about.card2.text')}</p>
            </div>
          </article>

          <article className="perk-card" style={{ flexDirection: 'column', gap: 20 }}>
            <div className="perk-card__icon" style={{ width: 52, height: 52 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20 12V22H4V12" />
                <path d="M22 7H2v5h20V7z" />
                <path d="M12 22V7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
            </div>
            <div>
              <h2 className="perk-card__title" style={{ fontSize: 18, marginBottom: 12 }}>{t('about.card3.title')}</h2>
              <p className="perk-card__text" style={{ fontSize: 14, lineHeight: 1.75 }}>{t('about.card3.text')}</p>
            </div>
          </article>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 16,
          }}
        >
          <div
            style={{
              padding: '32px 36px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--color-bg-elevated)',
            }}
          >
            <p
              style={{
                margin: '0 0 8px',
                color: 'var(--color-main)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              {t('about.catalogLabel')}
            </p>
            <h2
              style={{
                margin: '0 0 18px',
                fontSize: 'clamp(24px, 3vw, 32px)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              {t('about.catalogTitle')}
            </h2>
            <p style={{ margin: 0, color: 'var(--color-text-dim)', fontSize: 14, lineHeight: 1.75 }}>
              {t('about.catalogText')}
            </p>
          </div>

          <div
            style={{
              padding: '32px 36px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xl)',
              background:
                'radial-gradient(circle at top right, rgba(225, 29, 29, 0.1), transparent 28%), var(--color-bg-elevated)',
            }}
          >
            <p
              style={{
                margin: '0 0 8px',
                color: 'var(--color-main)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
              }}
            >
              {t('about.contactLabel')}
            </p>
            <h2
              style={{
                margin: '0 0 18px',
                fontSize: 'clamp(24px, 3vw, 32px)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
              }}
            >
              {t('about.contactTitle')}
            </h2>
            <p style={{ margin: '0 0 20px', color: 'var(--color-text-dim)', fontSize: 14, lineHeight: 1.75 }}>
              {t('about.contactText')}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <a
                href="https://www.avito.ru/brands/ff6ecb53876080972365fc0b263271ac"
                target="_blank"
                rel="noopener noreferrer"
                className="cta-btn"
                style={{ textDecoration: 'none' }}
              >
                {t('about.avitoBtn')}
              </a>
              <a href="mailto:hello@kolman.shop" className="ghost-btn" style={{ textDecoration: 'none' }}>
                {t('about.emailBtn')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
