// Admin "customer 360°" — one modal that shows every piece of data we have
// about a customer (profile + orders + inquiries + reviews + chat threads),
// behind a single click from the orders / inquiries / chat tabs.
//
// Esc closes. Click outside the panel closes. The modal is rendered into the
// component tree (not a portal) — z-index keeps it above admin chrome.

import { useEffect, useState } from 'react'
import { adminFetchCustomer, type Customer360 } from '../../lib/customerInbox'
import { isOnline, formatLastSeen } from '../../lib/presence'

type Props = {
  email: string | null
  onClose: () => void
  onOpenThread?: (threadId: number) => void
}

function fmt(n: number): string {
  return `${(n || 0).toLocaleString('ru-RU')} ₽`
}

const ORDER_LABEL: Record<string, string> = {
  new: 'новый',
  in_progress: 'в работе',
  done: 'выполнен',
  cancelled: 'отменён',
}

export default function CustomerModal({ email, onClose, onOpenThread }: Props) {
  const [data, setData] = useState<Customer360 | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!email) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    setData(null)
    void adminFetchCustomer(email).then(
      (d) => {
        if (!cancelled) {
          setData(d)
          setLoading(false)
        }
      },
      (e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'failed')
          setLoading(false)
        }
      },
    )
    return () => { cancelled = true }
  }, [email])

  useEffect(() => {
    if (!email) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [email, onClose])

  if (!email) return null

  const p = data?.profile
  const display = (p?.first_name || p?.last_name)
    ? [p?.first_name, p?.last_name].filter(Boolean).join(' ')
    : p?.name || email.split('@')[0]
  const online = isOnline(p?.last_seen_at)

  return (
    <div className="customer-modal" role="dialog" aria-modal="true" aria-label={`клиент ${email}`}>
      <button type="button" className="customer-modal__backdrop" onClick={onClose} aria-label="закрыть" />
      <div className="customer-modal__panel">
        <header className="customer-modal__head">
          <div className="customer-modal__head-main">
            {p?.photo
              ? <img src={p.photo} alt="" className="customer-modal__avatar" />
              : <div className="customer-modal__avatar customer-modal__avatar--placeholder">{display.charAt(0).toUpperCase()}</div>}
            <div style={{ minWidth: 0 }}>
              <h2 className="customer-modal__name">
                <span className={`presence-dot ${online ? 'presence-dot--online' : ''}`.trim()} aria-hidden="true" />
                {display}
              </h2>
              <div className="customer-modal__email">{email}</div>
              {p && (
                <div className="customer-modal__contacts">
                  {p.phone && <span>📞 {p.phone}</span>}
                  {p.telegram && <span>✉ {p.telegram}</span>}
                  <span className={online ? 'presence-label presence-label--online' : 'presence-label'}>
                    {online ? 'в сети' : formatLastSeen(p.last_seen_at)}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button type="button" className="customer-modal__close" onClick={onClose} aria-label="закрыть">×</button>
        </header>

        {loading && <p className="admin__empty-text" style={{ padding: 40 }}>Загрузка…</p>}
        {error && <p className="admin__empty-text" style={{ padding: 40, color: 'var(--color-main)' }}>{error}</p>}

        {data && (
          <>
            <section className="customer-modal__stats">
              <div className="customer-modal__stat">
                <span className="customer-modal__stat-label">Заказов</span>
                <strong className="customer-modal__stat-value">{data.stats.ordersCount}</strong>
              </div>
              <div className="customer-modal__stat">
                <span className="customer-modal__stat-label">Выручка</span>
                <strong className="customer-modal__stat-value">{fmt(data.stats.revenue)}</strong>
              </div>
              <div className="customer-modal__stat">
                <span className="customer-modal__stat-label">Открытых заявок</span>
                <strong className="customer-modal__stat-value">{data.stats.inquiriesOpen}</strong>
              </div>
              <div className="customer-modal__stat">
                <span className="customer-modal__stat-label">Чатов</span>
                <strong className="customer-modal__stat-value">{data.threads.length}</strong>
              </div>
            </section>

            <section className="customer-modal__section">
              <h3 className="customer-modal__title">Заказы ({data.orders.length})</h3>
              {data.orders.length === 0 ? (
                <p className="customer-modal__empty">Нет заказов.</p>
              ) : (
                <ul className="customer-modal__list">
                  {data.orders.map((o) => (
                    <li key={o.id} className="customer-modal__row">
                      <div>
                        <span className="customer-modal__row-id">#{o.id}</span>
                        <span className={`admin__inbox-status admin__inbox-status--${o.status}`}>
                          {ORDER_LABEL[o.status] ?? o.status}
                        </span>
                      </div>
                      <span className="customer-modal__row-meta">
                        {new Date(o.created_at).toLocaleDateString('ru-RU')} · {fmt(o.total)}
                      </span>
                      <span className="customer-modal__row-extra">
                        {o.items.length} поз. · {o.delivery || 'без доставки'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data.threads.length > 0 && (
              <section className="customer-modal__section">
                <h3 className="customer-modal__title">Чаты ({data.threads.length})</h3>
                <ul className="customer-modal__list">
                  {data.threads.map((th) => (
                    <li key={th.id} className="customer-modal__row">
                      <button
                        type="button"
                        className="customer-modal__link"
                        onClick={() => { onOpenThread?.(th.id); onClose() }}
                      >
                        {th.title || 'новый чат'}
                      </button>
                      <span className="customer-modal__row-meta">
                        {new Date(th.last_message_at).toLocaleString('ru-RU')}
                      </span>
                      <span className={`customer-modal__row-extra customer-modal__row-extra--${th.status}`}>
                        {th.status === 'open' ? 'открыт' : 'закрыт'}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.inquiries.length > 0 && (
              <section className="customer-modal__section">
                <h3 className="customer-modal__title">Заявки ({data.inquiries.length})</h3>
                <ul className="customer-modal__list">
                  {data.inquiries.map((q) => (
                    <li key={q.id} className="customer-modal__row">
                      <span className="customer-modal__row-id">#{q.id}</span>
                      <span className="customer-modal__row-meta">
                        {new Date(q.created_at).toLocaleDateString('ru-RU')} · {q.category}
                      </span>
                      <span className="customer-modal__row-extra" title={q.message}>
                        {q.message.slice(0, 80)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.reviews.length > 0 && (
              <section className="customer-modal__section">
                <h3 className="customer-modal__title">Отзывы ({data.reviews.length})</h3>
                <ul className="customer-modal__list">
                  {data.reviews.map((r) => (
                    <li key={r.id} className="customer-modal__row">
                      <span className="customer-modal__row-id">★ {r.rating}/5</span>
                      <span className="customer-modal__row-meta">
                        товар #{r.product_id} · {new Date(r.created_at).toLocaleDateString('ru-RU')}
                      </span>
                      <span className="customer-modal__row-extra" title={r.text}>
                        {r.text.slice(0, 80)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
