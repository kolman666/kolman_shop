import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { sendTelegramMessage } from '../lib/telegram'

const REQUEST_TYPE_VALUES = ['order', 'product', 'choose', 'delivery', 'other'] as const
type RequestTypeValue = (typeof REQUEST_TYPE_VALUES)[number]

// Telegram messages always in Russian (shop owner reads Russian)
const TELEGRAM_LABELS: Record<RequestTypeValue, string> = {
  order: 'проблема с заказом',
  product: 'вопрос о товаре',
  choose: 'помощь с выбором',
  delivery: 'доставка и оплата',
  other: 'другое',
}

type Status = 'idle' | 'loading' | 'success' | 'error'

async function sendToTelegram(fields: {
  requestType: RequestTypeValue
  name: string
  contact: string
  message: string
}) {
  const typeLabel = TELEGRAM_LABELS[fields.requestType]

  const text = [
    '📋 *новая заявка в поддержку*',
    '',
    `📌 *тип:* ${typeLabel}`,
    `👤 *имя:* ${fields.name || '—'}`,
    `📞 *контакт:* ${fields.contact || '—'}`,
    '',
    '💬 *вопрос:*',
    fields.message,
  ].join('\n')

  await sendTelegramMessage(text)
}

export default function SupportPage() {
  const { t } = useTranslation()
  const [requestType, setRequestType] = useState<RequestTypeValue>('other')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setStatus('loading')
    try {
      await sendToTelegram({ requestType, name, contact, message })
      setStatus('success')
      setMessage('')
      setName('')
      setContact('')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div className="catalog-shell">
        <div
          style={{
            width: 'min(1280px, calc(100% - 32px))',
            margin: '0 auto',
            display: 'grid',
            justifyItems: 'center',
            textAlign: 'center',
            gap: 20,
            padding: '60px 0',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(225, 29, 29, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-main)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(28px, 4vw, 40px)', letterSpacing: '-0.03em' }}>
            {t('support.successTitle')}
          </h1>
          <p style={{ margin: 0, color: 'var(--color-text-dim)', fontSize: 15, lineHeight: 1.7, maxWidth: '44ch' }}>
            {t('support.successText')}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="button" className="cta-btn" onClick={() => setStatus('idle')}>
              {t('support.sendAnother')}
            </button>
            <Link to="/" className="ghost-btn">
              {t('support.toHome')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="catalog-shell">
      <div className="catalog-hero" style={{ gridTemplateColumns: '1fr', marginBottom: 24 }}>
        <div>
          <span className="catalog-hero__eyebrow">{t('support.eyebrow')}</span>
          <h1 className="catalog-hero__title">{t('support.title')}</h1>
          <p className="catalog-hero__note">{t('support.subtitle')}</p>
        </div>
      </div>

      <div
        style={{
          width: 'min(1280px, calc(100% - 32px))',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 320px',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <form
          onSubmit={(e) => { void handleSubmit(e) }}
          style={{
            display: 'grid',
            gap: 16,
            padding: '32px 36px',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--color-bg-elevated)',
          }}
        >
          <div style={{ display: 'grid', gap: 10 }}>
            <label
              style={{
                color: 'var(--color-text-dim)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {t('support.requestTypeLabel')}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {REQUEST_TYPE_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`catalog-tab ${requestType === value ? 'active' : ''}`}
                  onClick={() => setRequestType(value)}
                >
                  {t(`support.types.${value}`)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="catalog-field" style={{ gap: 10 }}>
              <label className="catalog-field__label" htmlFor="support-name">
                {t('support.nameLabel')}
              </label>
              <input
                id="support-name"
                className="catalog-search__input"
                placeholder={t('support.namePlaceholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="catalog-field" style={{ gap: 10 }}>
              <label className="catalog-field__label" htmlFor="support-contact">
                {t('support.contactLabel')}
              </label>
              <input
                id="support-contact"
                className="catalog-search__input"
                placeholder={t('support.contactPlaceholder')}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
          </div>

          <div className="catalog-field" style={{ gap: 10 }}>
            <label className="catalog-field__label" htmlFor="support-message">
              {t('support.messageLabel')}
            </label>
            <textarea
              id="support-message"
              className="catalog-search__input"
              placeholder={t('support.messagePlaceholder')}
              rows={6}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {status === 'error' && (
            <p
              style={{
                margin: 0,
                padding: '12px 16px',
                borderRadius: 12,
                background: 'rgba(225, 29, 29, 0.1)',
                border: '1px solid rgba(225, 29, 29, 0.25)',
                color: 'var(--color-main-hover)',
                fontSize: 13,
              }}
            >
              {t('support.errorMsg')}
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="submit"
              className="cta-btn"
              disabled={status === 'loading' || !message.trim()}
              style={{ opacity: status === 'loading' || !message.trim() ? 0.55 : 1, cursor: status === 'loading' ? 'wait' : 'pointer' }}
            >
              {status === 'loading' ? t('support.submitLoading') : t('support.submitBtn')}
            </button>
            <p style={{ margin: 0, color: 'var(--color-text-ghost)', fontSize: 12 }}>
              {t('support.replyTime')}
            </p>
          </div>
        </form>

        <aside style={{ display: 'grid', gap: 14 }}>
          <div className="perk-card" style={{ flexDirection: 'column', gap: 16 }}>
            <div className="perk-card__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="perk-card__title" style={{ marginBottom: 8 }}>{t('support.card1.title')}</h3>
              <p className="perk-card__text">{t('support.card1.text')}</p>
            </div>
          </div>

          <div className="perk-card" style={{ flexDirection: 'column', gap: 16 }}>
            <div className="perk-card__icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <h3 className="perk-card__title" style={{ marginBottom: 8 }}>{t('support.card2.title')}</h3>
              <p className="perk-card__text">{t('support.card2.text')}</p>
            </div>
          </div>

          <div
            style={{
              padding: '22px 24px',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-bg-elevated)',
            }}
          >
            <p style={{ margin: '0 0 6px', color: 'var(--color-text-dim)', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {t('support.directContact')}
            </p>
            <a
              href="https://www.avito.ru/brands/ff6ecb53876080972365fc0b263271ac"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block',
                marginTop: 10,
                color: 'var(--color-text-soft)',
                fontSize: 13,
                textDecoration: 'none',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = 'var(--color-main-hover)')}
              onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = 'var(--color-text-soft)')}
            >
              авито →
            </a>
            <a
              href="mailto:hello@kolman.shop"
              style={{
                display: 'block',
                marginTop: 8,
                color: 'var(--color-text-soft)',
                fontSize: 13,
                textDecoration: 'none',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => ((e.target as HTMLAnchorElement).style.color = 'var(--color-main-hover)')}
              onMouseLeave={(e) => ((e.target as HTMLAnchorElement).style.color = 'var(--color-text-soft)')}
            >
              hello@kolman.shop →
            </a>
          </div>
        </aside>
      </div>
    </div>
  )
}
