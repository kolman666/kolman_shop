// Admin landing dashboard — single screen with everything the shop owner
// needs to know in the morning:
//
//   • Three revenue cards (today / 7d / 30d) with % delta vs previous period
//     and a tiny inline sparkline for the 30-day card.
//   • Status counters (clickable → jumps to filtered orders tab).
//   • "Нужно внимание" — actionable items (orders waiting tracking number,
//     open inquiries, open chats). Each row links into the relevant tab.
//   • Activity feed — last 10 orders with status pill + clickable customer.
//   • Top-5 products by units sold.
//   • Quick actions row — common admin shortcuts.
//
// Refreshes every 30s. All counts come from /api/orders?stats=1.

import { useEffect, useState } from 'react'
import {
  IconCart,
  IconChat,
  IconCheck,
  IconChevronRight,
  IconDocument,
  IconPackage,
  IconPlus,
  IconTicket,
} from '../../components/icons/UiIcons'

type Stats = {
  revenue: { today: number; yesterday: number; week: number; weekPrev: number; month: number; monthPrev: number }
  counts: {
    today: number; week: number; month: number
    new: number; in_progress: number; done: number; cancelled: number
  }
  aov: { current: number; previous: number }
  top: Array<{ title: string; qty: number; revenue: number }>
  daily: Array<{ date: string; revenue: number; orders: number }>
  pending: { needTracking: number; openInquiries: number; openChats: number }
  recentOrders: Array<{ id: number; customer_name: string; total: number; status: string; created_at: string }>
}

function adminHeaders(): Record<string, string> {
  return { 'X-Admin-Secret': sessionStorage.getItem('admin_secret') ?? '' }
}

function fmtMoney(n: number): string {
  return `${(n || 0).toLocaleString('ru-RU')} ₽`
}

function pctDelta(curr: number, prev: number): { value: number; sign: 'up' | 'down' | 'flat' } {
  if (prev === 0 && curr === 0) return { value: 0, sign: 'flat' }
  if (prev === 0) return { value: 100, sign: 'up' }
  const v = Math.round(((curr - prev) / prev) * 100)
  return { value: Math.abs(v), sign: v > 0 ? 'up' : v < 0 ? 'down' : 'flat' }
}

type Props = {
  onJumpToOrders?: (filter: 'new' | 'in_progress' | 'done' | 'cancelled' | '') => void
  onJumpToTab?: (tab: 'orders' | 'inquiries' | 'chat' | 'products' | 'promos') => void
}

export default function DashboardTab({ onJumpToOrders, onJumpToTab }: Props) {
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
        if (!cancelled) { setStats(data); setError('') }
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
    return (
      <div className="admin__content-tab">
        <div className="dash-skeleton">
          <div className="sk sk--block dash-skeleton__row" />
          <div className="sk sk--block dash-skeleton__row" />
          <div className="sk sk--block dash-skeleton__row" />
        </div>
      </div>
    )
  }
  if (error && !stats) {
    return (
      <div className="admin__content-tab">
        <p className="admin__empty-text">Не удалось загрузить статистику: {error}</p>
      </div>
    )
  }
  if (!stats) return null

  const todayDelta = pctDelta(stats.revenue.today, stats.revenue.yesterday)
  const weekDelta = pctDelta(stats.revenue.week, stats.revenue.weekPrev)
  const monthDelta = pctDelta(stats.revenue.month, stats.revenue.monthPrev)
  const aovDelta = pctDelta(stats.aov.current, stats.aov.previous)

  const totalPending = stats.pending.needTracking + stats.pending.openInquiries + stats.pending.openChats

  return (
    <div className="admin__content-tab dashboard">
      <header className="dashboard__head">
        <div>
          <h2 className="dashboard__title">Дашборд</h2>
          <p className="dashboard__sub">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            <span className="dashboard__pulse" title="данные обновляются каждые 30 секунд">
              <span className="dashboard__pulse-dot" /> авто-обновление
            </span>
          </p>
        </div>
      </header>

      {/* ── Revenue hero ─────────────────────────────────────────────────── */}
      <section className="dashboard__hero">
        <RevenueCard
          label="Сегодня"
          value={stats.revenue.today}
          orders={stats.counts.today}
          delta={todayDelta}
          deltaLabel="ко вчерашнему дню"
          gradient="hot"
        />
        <RevenueCard
          label="7 дней"
          value={stats.revenue.week}
          orders={stats.counts.week}
          delta={weekDelta}
          deltaLabel="к прошлой неделе"
          gradient="warm"
        />
        <RevenueCard
          label="30 дней"
          value={stats.revenue.month}
          orders={stats.counts.month}
          delta={monthDelta}
          deltaLabel="к предыдущим 30 дням"
          sparkline={stats.daily}
          gradient="cool"
        />
      </section>

      {/* ── AOV / status row ─────────────────────────────────────────────── */}
      <section className="dashboard__row">
        <div className="dash-aov">
          <span className="dash-aov__label">Средний чек, 30д</span>
          <strong className="dash-aov__value">{fmtMoney(stats.aov.current)}</strong>
          <span className={`dash-aov__delta dash-aov__delta--${aovDelta.sign}`}>
            {aovDelta.sign === 'up' ? '▲' : aovDelta.sign === 'down' ? '▼' : '—'} {aovDelta.value}%
          </span>
        </div>
        <div className="dash-status-row">
          <button type="button" className="dash-status dash-status--new" onClick={() => onJumpToOrders?.('new')}>
            <span className="dash-status__label">Новые</span>
            <strong className="dash-status__value">{stats.counts.new}</strong>
          </button>
          <button type="button" className="dash-status dash-status--progress" onClick={() => onJumpToOrders?.('in_progress')}>
            <span className="dash-status__label">В работе</span>
            <strong className="dash-status__value">{stats.counts.in_progress}</strong>
          </button>
          <button type="button" className="dash-status dash-status--done" onClick={() => onJumpToOrders?.('done')}>
            <span className="dash-status__label">Готово</span>
            <strong className="dash-status__value">{stats.counts.done}</strong>
          </button>
          <button type="button" className="dash-status dash-status--cancelled" onClick={() => onJumpToOrders?.('cancelled')}>
            <span className="dash-status__label">Отмены</span>
            <strong className="dash-status__value">{stats.counts.cancelled}</strong>
          </button>
        </div>
      </section>

      {/* ── Action items ─────────────────────────────────────────────────── */}
      <section className="dashboard__row dashboard__row--two">
        <article className={`dash-panel dash-panel--actions ${totalPending === 0 ? 'dash-panel--quiet' : ''}`.trim()}>
          <header className="dash-panel__head">
            <h3>Нужно внимание</h3>
            {totalPending > 0 && <span className="dash-panel__badge">{totalPending}</span>}
          </header>
          {totalPending === 0 ? (
            <p className="dash-panel__empty dash-panel__empty--ok">
              <IconCheck size={16} />
              <span>Всё закрыто. Можно выдохнуть.</span>
            </p>
          ) : (
            <ul className="dash-actions">
              {stats.pending.needTracking > 0 && (
                <li>
                  <button type="button" className="dash-action" onClick={() => onJumpToOrders?.('in_progress')}>
                    <span className="dash-action__icon dash-action__icon--ship"><IconPackage size={18} /></span>
                    <span className="dash-action__text">
                      <strong>{stats.pending.needTracking}</strong> заказ{plural(stats.pending.needTracking, ['','а','ов'])} без трек-номера
                    </span>
                    <span className="dash-action__arrow"><IconChevronRight size={16} /></span>
                  </button>
                </li>
              )}
              {stats.pending.openInquiries > 0 && (
                <li>
                  <button type="button" className="dash-action" onClick={() => onJumpToTab?.('inquiries')}>
                    <span className="dash-action__icon dash-action__icon--inq"><IconDocument size={18} /></span>
                    <span className="dash-action__text">
                      <strong>{stats.pending.openInquiries}</strong> открыт{plural(stats.pending.openInquiries, ['ая заявка', 'ые заявки', 'ых заявок'])}
                    </span>
                    <span className="dash-action__arrow"><IconChevronRight size={16} /></span>
                  </button>
                </li>
              )}
              {stats.pending.openChats > 0 && (
                <li>
                  <button type="button" className="dash-action" onClick={() => onJumpToTab?.('chat')}>
                    <span className="dash-action__icon dash-action__icon--chat"><IconChat size={18} /></span>
                    <span className="dash-action__text">
                      <strong>{stats.pending.openChats}</strong> открыт{plural(stats.pending.openChats, ['ый чат', 'ых чата', 'ых чатов'])}
                    </span>
                    <span className="dash-action__arrow"><IconChevronRight size={16} /></span>
                  </button>
                </li>
              )}
            </ul>
          )}
        </article>

        <article className="dash-panel dash-panel--actions">
          <header className="dash-panel__head">
            <h3>Быстрые действия</h3>
          </header>
          <div className="dash-quick">
            <button type="button" className="dash-quick__btn" onClick={() => onJumpToTab?.('products')}>
              <span className="dash-quick__icon"><IconPlus size={18} /></span>
              <span>Новый товар</span>
            </button>
            <button type="button" className="dash-quick__btn" onClick={() => onJumpToTab?.('promos')}>
              <span className="dash-quick__icon"><IconTicket size={18} /></span>
              <span>Создать промокод</span>
            </button>
            <button type="button" className="dash-quick__btn" onClick={() => onJumpToTab?.('orders')}>
              <span className="dash-quick__icon"><IconCart size={18} /></span>
              <span>Все заказы</span>
            </button>
            <button type="button" className="dash-quick__btn" onClick={() => onJumpToTab?.('chat')}>
              <span className="dash-quick__icon"><IconChat size={18} /></span>
              <span>Открыть чаты</span>
            </button>
          </div>
        </article>
      </section>

      {/* ── Recent activity + top products ───────────────────────────────── */}
      <section className="dashboard__row dashboard__row--two">
        <article className="dash-panel">
          <header className="dash-panel__head">
            <h3>Последние заказы</h3>
            <button type="button" className="dash-panel__link" onClick={() => onJumpToTab?.('orders')}>
              все →
            </button>
          </header>
          {stats.recentOrders.length === 0 ? (
            <p className="dash-panel__empty">Заказов ещё нет.</p>
          ) : (
            <ul className="dash-activity">
              {stats.recentOrders.map((o) => (
                <li key={o.id} className="dash-activity__row">
                  <span className={`dash-activity__status dash-activity__status--${o.status}`}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                  <span className="dash-activity__name">{o.customer_name || `#${o.id}`}</span>
                  <span className="dash-activity__time">{relTime(o.created_at)}</span>
                  <strong className="dash-activity__sum">{fmtMoney(o.total)}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="dash-panel">
          <header className="dash-panel__head">
            <h3>Топ-5 товаров, 30д</h3>
            <span className="dash-panel__hint">по проданным шт</span>
          </header>
          {stats.top.length === 0 ? (
            <p className="dash-panel__empty">Нет данных.</p>
          ) : (
            <ol className="dash-top-list">
              {stats.top.map((p, i) => {
                const max = stats.top[0]?.qty || 1
                const pct = Math.max(8, Math.round((p.qty / max) * 100))
                return (
                  <li key={p.title} className="dash-top-row">
                    <span className="dash-top-rank">{i + 1}</span>
                    <div className="dash-top-bar-wrap">
                      <span className="dash-top-name" title={p.title}>{p.title}</span>
                      <div className="dash-top-bar"><div style={{ width: `${pct}%` }} /></div>
                    </div>
                    <span className="dash-top-qty">{p.qty} шт</span>
                    <span className="dash-top-rev">{fmtMoney(p.revenue)}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </article>
      </section>
    </div>
  )
}

const STATUS_LABEL: Record<string, string> = {
  new: 'новый', in_progress: 'в работе', done: 'готов', cancelled: 'отменён',
}

function relTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  const min = Math.floor(diff / 60_000)
  if (min < 1) return 'только что'
  if (min < 60) return `${min} мин`
  const h = Math.floor(diff / 3_600_000)
  if (h < 24) return `${h} ч назад`
  const d = Math.floor(diff / 86_400_000)
  if (d < 7) return `${d} дн назад`
  const date = new Date(iso)
  const pad = (n: number) => n < 10 ? `0${n}` : String(n)
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}

// ── Revenue card with optional sparkline ─────────────────────────────────
function RevenueCard({
  label, value, orders, delta, deltaLabel, sparkline, gradient,
}: {
  label: string
  value: number
  orders: number
  delta: { value: number; sign: 'up' | 'down' | 'flat' }
  deltaLabel: string
  sparkline?: Array<{ date: string; revenue: number }>
  gradient: 'hot' | 'warm' | 'cool'
}) {
  return (
    <article className={`dash-card dash-card--${gradient}`}>
      <span className="dash-card__label">{label}</span>
      <strong className="dash-card__value">{fmtMoney(value)}</strong>
      <span className="dash-card__sub">
        <span className={`dash-card__delta dash-card__delta--${delta.sign}`}>
          {delta.sign === 'up' ? '▲' : delta.sign === 'down' ? '▼' : '—'} {delta.value}%
        </span>
        <span className="dash-card__delta-label">{deltaLabel}</span>
      </span>
      <span className="dash-card__orders">{orders} зак.</span>
      {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} />}
    </article>
  )
}

function Sparkline({ data }: { data: Array<{ date: string; revenue: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.revenue))
  const w = 220
  const h = 40
  const step = w / (data.length - 1)
  const points = data.map((d, i) => {
    const x = i * step
    const y = h - (d.revenue / max) * h
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const areaPoints = `0,${h} ${points} ${w},${h}`
  return (
    <svg className="dash-sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon className="dash-sparkline__area" points={areaPoints} />
      <polyline className="dash-sparkline__line" points={points} fill="none" />
    </svg>
  )
}
