import { useTranslation } from 'react-i18next'

type Tier = {
  id: string
  name: string
  priceLabel: string
  priceNote: string
  featured?: boolean
  features: string[]
}

type PerkItem = { title: string; text: string }

export default function PartnershipPage() {
  const { t } = useTranslation()

  const tiers = t('partnership.tiers', { returnObjects: true }) as Tier[]
  const perks = t('partnership.perks', { returnObjects: true }) as PerkItem[]

  return (
    <div className="page-shell">
      <div className="page-container">
        <header className="partner-hero">
          <span className="page-eyebrow">{t('partnership.eyebrow')}</span>
          <h1 className="partner-hero__title">{t('partnership.title')}</h1>
          <p className="partner-hero__sub">{t('partnership.subtitle')}</p>
        </header>

        <section className="partner-tiers" aria-label={t('partnership.title')}>
          {tiers.map((tier) => (
            <article
              key={tier.id}
              className={`partner-tier ${tier.featured ? 'partner-tier--featured' : ''}`.trim()}
            >
              {tier.featured && <span className="partner-tier__badge">{t('partnership.popularBadge')}</span>}
              <h3 className="partner-tier__name">{tier.name}</h3>
              <div className="partner-tier__price">{tier.priceLabel}</div>
              <p className="partner-tier__price-note">{tier.priceNote}</p>

              <ul className="partner-tier__features">
                {tier.features.map((feature) => (
                  <li key={feature} className="partner-tier__feature">
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="partner-tier__cta">
                <a
                  href="https://t.me/kolman_shop_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={tier.featured ? 'cta-btn' : 'ghost-btn'}
                  style={{ textDecoration: 'none' }}
                >
                  {tier.featured ? t('partnership.tierCtaPrimary') : t('partnership.tierCtaSecondary')}
                </a>
              </div>
            </article>
          ))}
        </section>

        <section>
          <p className="partner-perks-title">{t('partnership.perksTitle')}</p>
          <div className="partner-perks" style={{ marginTop: 14 }}>
            {perks.map((perk) => (
              <article key={perk.title} className="partner-perk">
                <h4 className="partner-perk__title">{perk.title}</h4>
                <p className="partner-perk__text">{perk.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-cta">
          <p className="page-eyebrow">{t('partnership.ctaLabel')}</p>
          <h2 className="about-cta__title">{t('partnership.title')}</h2>
          <p className="about-cta__text">{t('partnership.ctaText')}</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a
              href="https://t.me/kolman_shop_bot"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-btn"
              style={{ textDecoration: 'none' }}
            >
              {t('partnership.telegramBtn')}
            </a>
            <a
              href="mailto:hello@kolman.shop"
              className="ghost-btn"
              style={{ textDecoration: 'none' }}
            >
              {t('partnership.emailBtn')}
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}
