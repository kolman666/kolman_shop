// Admin landing dashboard. Pulls aggregated stats from /api/orders?stats=1
// (today / week / month revenue + status counts + top-5 products) so the
// shop owner sees the state of the business in one place instead of jumping
// between the orders, inquiries and chat tabs.
//
// Stats refresh on mount and every 30s while the tab is open.

import { useEffect, useState } from 'react'

type Stats = {
  revenue: { today: number; week: number; month: number }
  counts: {
    today: number
    week: number
    month: number
    new: number
    in_progress: number
    done: number
    cancelled: number
  }
  top: Array<{ title: string; qty: number; revenue: number }>
}

function adminHeaders(): Record<string, string> {
  return { 'X-Admin-Secret': sessionStorage.getItem('admin_secret') ?? '' }
}

function fmtMoney(n: number): string {
  return `${(n || 0).toLocaleString('ru-RU')} ₽`
}

export default function DashboardTab({ onJumpToOrders }: { onJumpToOrders?: (filter: 'new' | 'in_progress' | 'done' | 'cancelled' | '') => void }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let timer: number | null = null
    const load = async () => {
      try {
        const r = await fetch('/api/orders?stats=1', { headers: adminHeaders() })
        if (!r.ok) throw new Error(`${r.status}`)
        const data = (await r.json()) as Stats
        if (!cancelled) {
          setStats(data)
          setError('')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    timer = window.setInterval(load, 30_000)
    return () => {
      cancelled = true
      if (timer !== null) window.clearInterval(timer)
    }
  }, [])

  if (loading && !stats) {
    return <div className="admin__content-tab"><p className="admin__empty-text">Загрузка статистики…</p></div>
  }
  if (error && !stats) {
    return (
      <div className="admin__content-tab">
        <p className="admin__empty-text">Не удалось загрузить статистику: {error}</p>
      </div>
    )
  }
  if (!stats) return null

  return (
    <div className="admin__content-tab">
      <header className="admin__content-tab-head">
        <h2 className="admin__content-title">Дашборд</h2>
        <p className="admin__content-subtitle">
          Состояние магазина за последние 30 дней. Обновляется автоматически.
        </p>
      </header>

      <section className="dash-grid dash-grid--revenue">
        <article className="dash-card">
          <span className="dash-card__label">Выручка сегодня</span>
          <strong className="dash-card__value">{fmtMoney(stats.revenue.today)}</strong>
          <span className="dash-card__sub">{stats.counts.today} зак.</span>
        </article>
        <article className="dash-card">
          <span className="dash-card__label">За 7 дней</span>
          <strong className="dash-card__value">{fmtMoney(stats.revenue.week)}</strong>
          <span className="dash-card__sub">{stats.counts.week} зак.</span>
        </article>
        <article className="dash-card">
          <span className="dash-card__label">За 30 дней</span>
          <strong className="dash-card__value">{fmtMoney(stats.revenue.month)}</strong>
          <span className="dash-card__sub">{stats.counts.month} зак.</span>
        </article>
      </section>

      <section className="dash-grid dash-grid--statuses">
        <button
          type="button"
          className="dash-status dash-status--new"
          onClick={() => onJumpToOrders?.('new')}
        >
          <span className="dash-status__label">Новые</span>
          <strong className="dash-status__value">{stats.counts.new}</strong>
        </button>
        <button
          type="button"
          className="dash-status dash-status--progress"
          onClick={() => onJumpToOrders?.('in_progress')}
        >
          <span className="dash-status__label">В работе</span>
          <strong className="dash-status__value">{stats.counts.in_progress}</strong>
        </button>
        <button
          type="button"
          className="dash-status dash-status--done"
          onClick={() => onJumpToOrders?.('done')}
        >
          <span className="dash-status__label">Готово</span>
          <strong className="dash-status__value">{stats.counts.done}</strong>
        </button>
        <button
          type="button"
          className="dash-status dash-status--cancelled"
          onClick={() => onJumpToOrders?.('cancelled')}
        >
          <span className="dash-status__label">Отменены</span>
          <strong className="dash-status__value">{stats.counts.cancelled}</strong>
        </button>
      </section>

      <section className="dash-top">
        <header className="dash-top__head">
          <h3 className="dash-top__title">Топ‑5 товаров за 30 дней</h3>
          <span className="dash-top__hint">по количеству проданного</span>
        </header>
        {stats.top.length === 0 ? (
          <p className="admin__empty-text" style={{ padding: 20 }}>Нет данных за период.</p>
        ) : (
          <ol className="dash-top__list">
            {stats.top.map((p, i) => (
              <li key={p.title} className="dash-top__row">
                <span className="dash-top__rank">{i + 1}</span>
                <span className="dash-top__name" title={p.title}>{p.title}</span>
                <span className="dash-top__qty">{p.qty} шт.</span>
                <span className="dash-top__rev">{fmtMoney(p.revenue)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
