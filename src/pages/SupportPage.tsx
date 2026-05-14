import { useReducer, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { sendTelegramMessage, TelegramSendError } from '../lib/telegram'

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

type SupportState = {
  requestType: RequestTypeValue
  name: string
  contact: string
  message: string
  status: Status
  errorDetail: string
}

type SupportAction =
  | { type: 'setRequestType'; value: RequestTypeValue }
  | { type: 'setName'; value: string }
  | { type: 'setContact'; value: string }
  | { type: 'setMessage'; value: string }
  | { type: 'submitStart' }
  | { type: 'submitSuccess' }
  | { type: 'submitError'; detail: string }
  | { type: 'sendAnother' }

const INITIAL_SUPPORT_STATE: SupportState = {
  requestType: 'other',
  name: '',
  contact: '',
  message: '',
  status: 'idle',
  errorDetail: '',
}

function supportReducer(state: SupportState, action: SupportAction): SupportState {
  switch (action.type) {
    case 'setRequestType':
      return { ...state, requestType: action.value }
    case 'setName':
      return { ...state, name: action.value }
    case 'setContact':
      return { ...state, contact: action.value }
    case 'setMessage':
      return { ...state, message: action.value }
    case 'submitStart':
      return { ...state, status: 'loading', errorDetail: '' }
    case 'submitSuccess':
      return { ...state, name: '', contact: '', message: '', status: 'success', errorDetail: '' }
    case 'submitError':
      return { ...state, status: 'error', errorDetail: action.detail }
    case 'sendAnother':
      return { ...state, status: 'idle', errorDetail: '' }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function submitInquiry(fields: {
  requestType: RequestTypeValue
  name: string
  contact: string
  message: string
}) {
  const typeLabel = TELEGRAM_LABELS[fields.requestType]
  const safeName = escapeHtml(fields.name.slice(0, 200))
  const safeContact = escapeHtml(fields.contact.slice(0, 200))
  const safeMessage = escapeHtml(fields.message.slice(0, 3500))

  const text = [
    '📋 <b>новая заявка в поддержку</b>',
    '',
    `📌 <b>тип:</b> ${escapeHtml(typeLabel)}`,
    `👤 <b>имя:</b> ${safeName || '—'}`,
    `📞 <b>контакт:</b> ${safeContact || '—'}`,
    '',
    '💬 <b>вопрос:</b>',
    safeMessage,
  ].join('\n')

  // Try the new inquiries endpoint (stores in DB), fall back to plain telegram
  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: fields.requestType,
        name: fields.name,
        contact: fields.contact,
        message: fields.message,
        telegram_text: text,
      }),
    })
    if (!res.ok) {
      // Endpoint missing OR DB table not migrated yet — still send to Telegram so the inquiry isn't lost
      if (res.status === 404 || res.status === 405) {
        await sendTelegramMessage(text)
        return
      }
      const body = await res.json().catch(() => ({}))
      const errMsg = (body as { error?: string }).error ?? 'request failed'
      const detail = (body as { detail?: string }).detail
      if (res.status === 503 && errMsg === 'table_not_found') {
        await sendTelegramMessage(text)
        return
      }
      throw new TelegramSendError(res.status, errMsg, detail)
    }
  } catch (err) {
    if (err instanceof TelegramSendError) throw err
    await sendTelegramMessage(text)
  }
}

export default function SupportPage() {
  const { t } = useTranslation()
  const [state, dispatch] = useReducer(supportReducer, INITIAL_SUPPORT_STATE)
  const { requestType, name, contact, message, status, errorDetail } = state

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    dispatch({ type: 'submitStart' })
    try {
      await submitInquiry({ requestType, name, contact, message })
      dispatch({ type: 'submitSuccess' })
    } catch (err) {
      dispatch({ type: 'submitError', detail: err instanceof TelegramSendError ? err.detail || err.message || '' : '' })
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
            <button type="button" className="cta-btn" onClick={() => dispatch({ type: 'sendAnother' })}>
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

      <div className="support-layout">
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
                  onClick={() => dispatch({ type: 'setRequestType', value })}
                >
                  {t(`support.types.${value}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="support-fields-row">
            <div className="catalog-field" style={{ gap: 10 }}>
              <label className="catalog-field__label" htmlFor="support-name">
                {t('support.nameLabel')}
              </label>
              <input
                id="support-name"
                className="catalog-search__input"
                placeholder={t('support.namePlaceholder')}
                value={name}
                onChange={(e) => dispatch({ type: 'setName', value: e.target.value })}
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
                onChange={(e) => dispatch({ type: 'setContact', value: e.target.value })}
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
              onChange={(e) => dispatch({ type: 'setMessage', value: e.target.value })}
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
              {t('support.errorMsg')}{errorDetail ? ` (${errorDetail})` : ''}
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
