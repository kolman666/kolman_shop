import { useEffect, useReducer, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { sendTelegramMessage, TelegramSendError } from '../lib/telegram'
import { usePageContent } from '../hooks/usePageContent'
import { getUser } from '../lib/auth'

const REQUEST_TYPE_VALUES = ['order', 'product', 'choose', 'delivery', 'other'] as const
type RequestTypeValue = (typeof REQUEST_TYPE_VALUES)[number]

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

type Channel = { name: string; value: string; href: string }
type QuickTopic = { type: RequestTypeValue; label: string }

export default function SupportPage() {
  const { t } = useTranslation()
  const get = usePageContent('support', 'support')
  const [state, dispatch] = useReducer(supportReducer, INITIAL_SUPPORT_STATE)
  const { requestType, name, contact, message, status, errorDetail } = state

  // Pre-fill name and contact when a user is logged in. Form remains fully
  // editable so the user can change either field if they want.
  useEffect(() => {
    const user = getUser()
    if (!user) return
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.name
    if (fullName && !state.name) dispatch({ type: 'setName', value: fullName })
    const preferContact = user.phone?.trim() || user.email
    if (preferContact && !state.contact) dispatch({ type: 'setContact', value: preferContact })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const channels = t('support.channels', { returnObjects: true }) as Channel[]
  const quickTopics = t('support.quickTopics', { returnObjects: true }) as QuickTopic[]

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
      <div className="page-shell">
        <div className="page-container" style={{ justifyItems: 'center', textAlign: 'center', padding: '60px 0' }}>
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
    <div className="page-shell">
      <div className="page-container">
        <header className="partner-hero" style={{ textAlign: 'left', padding: '20px 0 0' }}>
          <span className="page-eyebrow">{get('eyebrow')}</span>
          <h1 className="partner-hero__title" style={{ marginTop: 8, marginBottom: 10 }}>{get('title')}</h1>
          <p className="partner-hero__sub" style={{ marginLeft: 0 }}>{get('subtitle')}</p>
        </header>

        <div className="support-v2">
          <form className="support-v2__form" onSubmit={(e) => { void handleSubmit(e) }}>
            <h2 className="support-v2__form-title">{t('support.requestTypeLabel')}</h2>
            <div className="support-chips">
              {REQUEST_TYPE_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`support-chip ${requestType === value ? 'support-chip--active' : ''}`.trim()}
                  onClick={() => dispatch({ type: 'setRequestType', value })}
                >
                  {t(`support.types.${value}`)}
                </button>
              ))}
            </div>

            <div className="support-fields-row">
              <div className="catalog-field" style={{ gap: 10 }}>
                <label className="catalog-field__label" htmlFor="support-name">{t('support.nameLabel')}</label>
                <input
                  id="support-name"
                  className="catalog-search__input"
                  placeholder={t('support.namePlaceholder')}
                  value={name}
                  onChange={(e) => dispatch({ type: 'setName', value: e.target.value })}
                />
              </div>
              <div className="catalog-field" style={{ gap: 10 }}>
                <label className="catalog-field__label" htmlFor="support-contact">{t('support.contactLabel')}</label>
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
              <label className="catalog-field__label" htmlFor="support-message">{t('support.messageLabel')}</label>
              <textarea
                id="support-message"
                className="catalog-search__input"
                placeholder={t('support.messagePlaceholder')}
                rows={7}
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
              <p style={{ margin: 0, color: 'var(--color-text-ghost)', fontSize: 12 }}>{t('support.replyTime')}</p>
            </div>
          </form>

          <aside className="support-aside">
            <div className="support-stat-card">
              <div className="support-stat-card__value">{get('statResponse')}</div>
              <div className="support-stat-card__label">{get('statResponseLabel')}</div>
            </div>

            <div className="support-aside-card">
              <h3 className="support-aside__title">{t('support.channelsTitle')}</h3>
              {channels.map((ch) => (
                <a
                  key={ch.name}
                  href={ch.href}
                  target={ch.href.startsWith('http') ? '_blank' : undefined}
                  rel={ch.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className="support-channel"
                >
                  <div>
                    <span className="support-channel__name">{ch.name}</span>
                    <span className="support-channel__value">{ch.value}</span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </a>
              ))}
            </div>

            <div className="support-aside-card support-aside-card--accent">
              <h3 className="support-aside__title">{t('support.quickTopicsTitle')}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {quickTopics.map((topic) => (
                  <button
                    key={topic.type}
                    type="button"
                    className={`support-chip ${requestType === topic.type ? 'support-chip--active' : ''}`.trim()}
                    onClick={() => dispatch({ type: 'setRequestType', value: topic.type })}
                  >
                    {topic.label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
