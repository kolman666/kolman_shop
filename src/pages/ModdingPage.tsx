import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type Perk = { title: string; text: string }
type ProcessStep = { step: string; title: string; text: string }
type ServiceCategory = 'keyboards' | 'mice'
type Service = {
  id: string
  category: ServiceCategory
  tag?: string
  title: string
  desc: string
  features: string[]
  price: string
}
type Bundle = {
  id: string
  savings: string
  title: string
  desc: string
  features: string[]
  priceOld: string
  priceNew: string
  cta: string
}

const perkIcons: ReactNode[] = [
  (
    <svg key="sound" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  ),
  (
    <svg key="control" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  (
    <svg key="shield" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
]

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function ModdingPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'all' | ServiceCategory>('all')

  const perks = t('modding.perks', { returnObjects: true }) as Perk[]
  const processSteps = t('modding.processSteps', { returnObjects: true }) as ProcessStep[]
  const services = t('modding.services', { returnObjects: true }) as Service[]
  const bundles = t('modding.bundles', { returnObjects: true }) as Bundle[]

  const visibleServices = tab === 'all' ? services : services.filter((s) => s.category === tab)

  return (
    <div className="page-shell">
      <div className="page-container">
        <section className="modding-hero">
          <span className="modding-hero__eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14.7 6.3a4 4 0 0 1 0 5.6L11 15.6l-2.6-2.6 3.7-3.7a4 4 0 0 1 2.6-1zM9 13.4 3 19.4V21h1.6L10.6 15" />
            </svg>
            {t('modding.eyebrow')}
          </span>
          <h1 className="modding-hero__title">
            {t('modding.titleStart')} <span className="modding-hero__accent">{t('modding.titleAccent')}</span> {t('modding.titleEnd')}
          </h1>
          <p className="modding-hero__sub">{t('modding.subtitle')}</p>
        </section>

        <section className="modding-perks" aria-label={t('modding.eyebrow')}>
          {perks.map((perk, idx) => (
            <article key={perk.title} className="modding-perk">
              <div className="modding-perk__icon">{perkIcons[idx]}</div>
              <h3 className="modding-perk__title">{perk.title}</h3>
              <p className="modding-perk__text">{perk.text}</p>
            </article>
          ))}
        </section>

        <section className="modding-process">
          <h2 className="modding-process__title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-main)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {t('modding.processTitle')}
          </h2>
          <div className="modding-process__steps">
            {processSteps.map((step) => (
              <div key={step.step}>
                <div className="modding-process__step-label">{step.step}</div>
                <h3 className="modding-process__step-title">{step.title}</h3>
                <p className="modding-process__step-text">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ display: 'grid', gap: 20 }}>
          <div className="modding-tabs" role="tablist">
            {(['all', 'keyboards', 'mice'] as const).map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`modding-tab ${tab === key ? 'modding-tab--active' : ''}`.trim()}
                onClick={() => setTab(key)}
              >
                {t(`modding.tabs.${key}`)}
              </button>
            ))}
          </div>

          <div className="modding-services">
            {visibleServices.map((service) => (
              <article key={service.id} className="modding-service">
                {service.tag && <span className="modding-service__tag">{service.tag}</span>}
                <h3 className="modding-service__title">{service.title}</h3>
                <p className="modding-service__desc">{service.desc}</p>
                <ul className="modding-service__features">
                  {service.features.map((feature) => (
                    <li key={feature} className="modding-service__feature">
                      <CheckIcon />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="modding-service__footer">
                  <strong className="modding-service__price">{service.price}</strong>
                  <a
                    href="https://t.me/kolman_shop_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="modding-service__arrow"
                    aria-label={service.title}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section style={{ display: 'grid', gap: 18 }}>
          <header className="modding-bundles-head">
            <h2 className="modding-bundles-head__title">{t('modding.bundlesTitle')}</h2>
            <p className="modding-bundles-head__sub">{t('modding.bundlesSubtitle')}</p>
          </header>

          <div className="modding-bundles">
            {bundles.map((bundle) => (
              <article key={bundle.id} className="modding-bundle">
                <div className="modding-bundle__shape" aria-hidden="true" />
                <span className="modding-bundle__badge">{bundle.savings}</span>
                <h3 className="modding-bundle__title">{bundle.title}</h3>
                <p className="modding-bundle__desc">{bundle.desc}</p>
                <ul className="modding-bundle__features">
                  {bundle.features.map((feature) => (
                    <li key={feature} className="modding-bundle__feature">
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="modding-bundle__footer">
                  <div>
                    <span className="modding-bundle__price-old">{bundle.priceOld}</span>
                    <span className="modding-bundle__price-new">{bundle.priceNew}</span>
                  </div>
                  <a
                    href="https://t.me/kolman_shop_bot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="modding-bundle__cta"
                  >
                    {bundle.cta}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="modding-final-cta">
          <h2 className="modding-final-cta__title">{t('modding.finalCta.title')}</h2>
          <p className="modding-final-cta__text">{t('modding.finalCta.text')}</p>
          <a
            href="https://t.me/kolman_shop_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-btn"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {t('modding.finalCta.btn')}
          </a>
        </section>
      </div>
    </div>
  )
}
