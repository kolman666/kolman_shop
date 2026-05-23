import { useCallback, useEffect, useState } from 'react'
import { fetchAuditLog, type AuditLogRow } from '../../lib/adminAudit'

const ACTION_LABELS: Record<string, string> = {
  'admin.login': 'Вход в админку',
  'product.create': 'Товар создан',
  'product.update': 'Товар изменён',
  'product.delete': 'Товар удалён',
  'order.update': 'Заказ обновлён',
  'order.delete': 'Заказ удалён',
  'promo.create': 'Промокод сохранён',
  'promo.delete': 'Промокод удалён',
  'content.update': 'Контент сохранён',
  'blogger.create': 'Блогер создан',
  'blogger.update': 'Блогер изменён',
  'blogger.delete': 'Блогер удалён',
  'inquiry.update': 'Заявка обновлена',
  'inquiry.delete': 'Заявка удалена',
  'chat.reply': 'Ответ в чате',
  'media.upload': 'Медиа загружено',
  'media.delete': 'Медиа удалено',
  'media.import': 'Импорт медиа',
  'review.delete': 'Отзыв удалён',
}

function labelFor(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function AuditLogTab() {
  const [items, setItems] = useState<AuditLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 60

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await fetchAuditLog({ limit, offset, q })
      setItems(r.items)
      setTotal(r.total)
      setNeedsMigration(Boolean(r.needsMigration))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setLoading(false)
    }
  }, [offset, q])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const t = window.setInterval(() => { void load() }, 20_000)
    return () => window.clearInterval(t)
  }, [load])

  useEffect(() => {
    setOffset(0)
  }, [q])

  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="admin__content-tab">
      <header className="admin__content-tab-head">
        <h2 className="admin__content-title">Журнал действий</h2>
        <p className="admin__content-subtitle">
          Все изменения в админке: товары, заказы, контент, промокоды, медиа и чаты. Обновляется автоматически каждые 20 секунд.
        </p>
      </header>

      <div className="audit-log__toolbar">
        <input
          type="search"
          className="admin__input"
          placeholder="поиск по действию, сущности, тексту…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <span className="admin__label-hint">{total} записей</span>
        <button type="button" className="ghost-btn" onClick={() => void load()} disabled={loading}>
          обновить
        </button>
      </div>

      {needsMigration && (
        <p className="admin__empty-text" style={{ color: 'var(--color-main)' }}>
          Таблица <code>admin_audit_log</code> не создана — выполните SQL из блока миграции в админке.
        </p>
      )}

      {error && <p className="admin__empty-text" style={{ color: 'var(--color-main)' }}>{error}</p>}

      {loading && items.length === 0 ? (
        <p className="admin__empty-text" style={{ padding: 40 }}>Загрузка…</p>
      ) : items.length === 0 ? (
        <div className="admin__content-empty">
          <p className="admin__empty-text">Записей пока нет.</p>
        </div>
      ) : (
        <ul className="audit-log__list">
          {items.map((row) => (
            <li key={row.id} className="audit-log__row">
              <div className="audit-log__row-head">
                <span className="audit-log__action">{labelFor(row.action)}</span>
                <time className="audit-log__time" dateTime={row.created_at}>{fmtTime(row.created_at)}</time>
              </div>
              <p className="audit-log__summary">{row.summary}</p>
              <ChangesDiff meta={row.meta} />
              {(row.entity || row.entity_id) && (
                <p className="audit-log__meta-line">
                  {row.entity && <span className="audit-log__tag">{row.entity}</span>}
                  {row.entity_id && <code className="audit-log__id">{row.entity_id}</code>}
                  {row.ip && row.ip !== 'unknown' && <span className="audit-log__ip">{row.ip}</span>}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* see ChangesDiff component below */}
      {totalPages > 1 && (
        <div className="audit-log__pager">
          <button
            type="button"
            className="ghost-btn"
            disabled={offset <= 0 || loading}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
          >
            ← назад
          </button>
          <span className="admin__label-hint">{page} / {totalPages}</span>
          <button
            type="button"
            className="ghost-btn"
            disabled={offset + limit >= total || loading}
            onClick={() => setOffset((o) => o + limit)}
          >
            вперёд →
          </button>
        </div>
      )}
    </div>
  )
}

// Renders a "field: before → after" diff list from `meta.changes`. Each
// change comes from writeAuditLog(... { changes: [...] }). Hidden when
// the meta blob has no changes (older rows or actions without diffs).
type ChangeEntry = { field?: string; before?: unknown; after?: unknown }

function ChangesDiff({ meta }: { meta?: Record<string, unknown> }) {
  const changes = Array.isArray((meta ?? {}).changes) ? ((meta as { changes: ChangeEntry[] }).changes) : []
  if (changes.length === 0) return null
  return (
    <ul className="audit-log__changes">
      {changes.map((c, i) => (
        <li key={`${c.field}-${i}`} className="audit-log__change">
          <span className="audit-log__change-field">{c.field ?? '—'}</span>
          <span className="audit-log__change-before" title={JSON.stringify(c.before)}>
            {fmtVal(c.before)}
          </span>
          <span className="audit-log__change-arrow" aria-hidden>→</span>
          <span className="audit-log__change-after" title={JSON.stringify(c.after)}>
            {fmtVal(c.after)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'string') return v === '' ? '(пусто)' : v.length > 60 ? `«${v.slice(0, 60)}…»` : `«${v}»`
  if (typeof v === 'number') return v.toLocaleString('ru-RU')
  if (typeof v === 'boolean') return v ? 'да' : 'нет'
  if (Array.isArray(v)) return `${v.length} эл.`
  try {
    const s = JSON.stringify(v)
    return s.length > 60 ? `${s.slice(0, 60)}…` : s
  } catch {
    return String(v).slice(0, 60)
  }
}
