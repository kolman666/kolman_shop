import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getUser } from '../lib/auth'

// "Notify me when back in stock" — captures demand for out-of-stock products.
// Posts to /api/inquiries?resource=stock; the admin gets a Telegram ping and
// sees the waitlist in the admin panel. Prefills the email for signed-in users.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function StockNotify({ productId }: { productId: number }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState(() => getUser()?.email ?? '')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = email.trim().toLowerCase()
    if (!EMAIL_RE.test(v)) { setStatus('error'); return }
    setStatus('sending')
    try {
      const r = await fetch('/api/inquiries?resource=stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId, email: v }),
      })
      setStatus(r.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'done') {
    return (
      <div className="stock-notify stock-notify--done">
        {t('ui.stockNotify.done', { defaultValue: '✓ Сообщим, как только товар появится' })}
      </div>
    )
  }

  return (
    <form className="stock-notify" onSubmit={submit}>
      <p className="stock-notify__label">
        {t('ui.stockNotify.label', { defaultValue: 'Нет в наличии — сообщить о поступлении?' })}
      </p>
      <div className="stock-notify__row">
        <input
          type="email"
          className="stock-notify__input"
          placeholder={t('ui.stockNotify.placeholder', { defaultValue: 'ваш email' })}
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (status === 'error') setStatus('idle') }}
          required
        />
        <button type="submit" className="stock-notify__btn" disabled={status === 'sending'}>
          {status === 'sending' ? '…' : t('ui.stockNotify.submit', { defaultValue: 'сообщить' })}
        </button>
      </div>
      {status === 'error' && (
        <span className="stock-notify__error">
          {t('ui.stockNotify.error', { defaultValue: 'Проверьте email и попробуйте ещё раз' })}
        </span>
      )}
    </form>
  )
}
