import { useState } from 'react'
import { useTranslation } from 'react-i18next'

type FaqItem = { q: string; a: string }

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="delivery-faq__item">
      <button
        type="button"
        className="delivery-faq__q"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>{item.q}</span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <p className="delivery-faq__a">{item.a}</p>}
    </div>
  )
}

export default function DeliveryPage() {
  const { t } = useTranslation()
  const faq = t('delivery.faq', { returnObjects: true }) as FaqItem[]

  const infoCards = [
    {
      key: 'card1',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="1" y="3" width="15" height="13" rx="2" />
          <path d="M16 8h4l3 5v3h-7V8z" />
          <circle cx="5.5" cy="18.5" r="2.5" />
          <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
      ),
    },
    {
      key: 'card2',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="1" y="4" width="22" height="16" rx="2" />
          <path d="M1 10h22" />
        </svg>
      ),
    },
    {
      key: 'card3',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="catalog-shell">
      <div className="catalog-hero" style={{ gridTemplateColumns: '1fr', marginBottom: 24 }}>
        <div>
          <span className="catalog-hero__eyebrow">{t('delivery.eyebrow')}</span>
          <h1 className="catalog-hero__title">{t('delivery.title')}</h1>
          <p className="catalog-hero__note">{t('delivery.subtitle')}</p>
        </div>
      </div>

      <div style={{ width: 'min(1280px, calc(100% - 32px))', margin: '0 auto', display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {infoCards.map(({ key, icon }) => (
            <article key={key} className="perk-card" style={{ flexDirection: 'column', gap: 20 }}>
              <div className="perk-card__icon" style={{ width: 52, height: 52 }}>{icon}</div>
              <div>
                <h2 className="perk-card__title" style={{ fontSize: 18, marginBottom: 12 }}>{t(`delivery.${key}.title`)}</h2>
                <p className="perk-card__text" style={{ fontSize: 14, lineHeight: 1.75 }}>{t(`delivery.${key}.text`)}</p>
              </div>
            </article>
          ))}
        </div>

        <div
          style={{
            padding: '32px 36px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--color-bg-elevated)',
          }}
        >
          <p style={{ margin: '0 0 20px', color: 'var(--color-text-dim)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {t('delivery.faqTitle')}
          </p>
          <div className="delivery-faq">
            {faq.map((item, i) => (
              <FaqRow key={i} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
