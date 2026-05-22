import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageContent, usePageData } from '../hooks/usePageContent'

type FaqItem = { q: string; a: string }
type TimelineStep = { num: string; title: string; text: string }
type PaymentMethod = { name: string; text: string }
type CoverageRow = { region: string; text: string }

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

type DeliveryAdminData = {
  timeline?: TimelineStep[]
  payment?: PaymentMethod[]
  coverage?: CoverageRow[]
  faq?: FaqItem[]
}

export default function DeliveryPage() {
  const { t } = useTranslation()
  const get = usePageContent('delivery', 'delivery')
  const admin = usePageData<DeliveryAdminData>('delivery')
  const faq = (admin.faq && admin.faq.length > 0) ? admin.faq : (t('delivery.faq', { returnObjects: true }) as FaqItem[])
  const timeline = (admin.timeline && admin.timeline.length > 0) ? admin.timeline : (t('delivery.timeline', { returnObjects: true }) as TimelineStep[])
  const payment = (admin.payment && admin.payment.length > 0) ? admin.payment : (t('delivery.payment', { returnObjects: true }) as PaymentMethod[])
  const coverage = (admin.coverage && admin.coverage.length > 0) ? admin.coverage : (t('delivery.coverage', { returnObjects: true }) as CoverageRow[])

  return (
    <div className="page-shell">
      <div className="page-container">
        <header className="delivery-hero">
          <div className="delivery-hero__copy">
            <span className="page-eyebrow">{get('eyebrow')}</span>
            <h1 className="delivery-hero__title">{get('title')}</h1>
            <p className="delivery-hero__sub">{get('subtitle')}</p>
          </div>
          <span className="delivery-chip">
            <span className="delivery-chip__dot" />
            {get('statusChip')}
          </span>
        </header>

        <section>
          <p className="section-block-title">{get('timelineTitle')}</p>
          <div className="delivery-timeline">
            {timeline.map((step) => (
              <article key={step.num} className="delivery-tl-step">
                <div className="delivery-tl-step__num">{step.num}</div>
                <h3 className="delivery-tl-step__title">{step.title}</h3>
                <p className="delivery-tl-step__text">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="delivery-bigrow">
          <div>
            <p className="section-block-title">{get('paymentTitle')}</p>
            <div className="delivery-payment">
              {payment.map((m) => (
                <article key={m.name} className="delivery-payment__card">
                  <h3 className="delivery-payment__card-title">{m.name}</h3>
                  <p className="delivery-payment__card-text">{m.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div>
            <p className="section-block-title">&nbsp;</p>
            <div className="delivery-coverage">
              <h3 style={{ margin: 0, fontSize: 16, color: 'var(--color-text)' }}>{get('coverageTitle')}</h3>
              <ul className="delivery-coverage__list">
                {coverage.map((row) => (
                  <li key={row.region} className="delivery-coverage__row">
                    <span>{row.region}</span>
                    <span className="delivery-coverage__time">{row.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section
          style={{
            padding: '32px 36px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--color-bg-elevated)',
          }}
        >
          <p className="section-block-title">{get('faqTitle')}</p>
          <div className="delivery-faq">
            {faq.map((item) => (
              <FaqRow key={`${item.q}-${item.a}`} item={item} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
