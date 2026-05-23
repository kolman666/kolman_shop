// Admin CRUD for promo codes. Reads from /api/orders?promos=1, mutates via
// POST/DELETE on the same endpoint. Codes are short (≤ 32 chars) so editing
// inline is fine — no separate "edit" form, just upsert on save.

import { useEffect, useState } from 'react'

type PromoRow = {
  code: string
  kind: 'percent' | 'fixed'
  value: number
  min_total: number
  valid_from: string | null
  valid_to: string | null
  max_uses: number | null
  used_count: number
  note: string | null
  created_at?: string
}

function adminHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Secret': sessionStorage.getItem('admin_secret') ?? '',
  }
}

async function listPromos(): Promise<PromoRow[]> {
  const r = await fetch('/api/orders?promos=1', { headers: adminHeaders() })
  if (!r.ok) return []
  return r.json() as Promise<PromoRow[]>
}

const PROMO_ERRORS: Record<string, string> = {
  'cart is empty': 'ошибка сервера: запрос ушёл в оформление заказа вместо промокодов',
  unauthorized: 'нужен вход в админку',
  'invalid code': 'некорректный код',
  'invalid kind': 'некорректный тип скидки',
  'invalid value': 'некорректное значение',
  'percent must be 1..99': 'процент должен быть от 1 до 99',
  table_not_found: 'таблица promo_codes не создана — выполните SQL-миграцию',
}

function promoErrorMessage(code: string): string {
  return PROMO_ERRORS[code] ?? code
}

async function savePromo(row: Partial<PromoRow>) {
  const r = await fetch('/api/orders?promo=1', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify(row),
  })
  if (!r.ok) {
    const b = await r.json().catch(() => ({}))
    const raw = (b as { error?: string }).error ?? `${r.status}`
    throw new Error(promoErrorMessage(raw))
  }
  return r.json()
}

async function deletePromo(code: string) {
  const r = await fetch('/api/orders?promo=1', {
    method: 'DELETE',
    headers: adminHeaders(),
    body: JSON.stringify({ code }),
  })
  if (!r.ok) throw new Error(`${r.status}`)
}

export default function PromoTab() {
  const [rows, setRows] = useState<PromoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Partial<PromoRow>>({ code: '', kind: 'percent', value: 10 })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const list = await listPromos()
      setRows(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() }, [])

  async function onCreate() {
    setSaving(true)
    setError('')
    try {
      await savePromo({
        ...draft,
        code: (draft.code ?? '').toString().toUpperCase().trim(),
      })
      setDraft({ code: '', kind: 'percent', value: 10 })
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(code: string) {
    if (!confirm(`Удалить промокод ${code}?`)) return
    try {
      await deletePromo(code)
      setRows((prev) => prev.filter((r) => r.code !== code))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    }
  }

  return (
    <div className="admin__content-tab">
      <header className="admin__content-tab-head">
        <h2 className="admin__content-title">Промокоды</h2>
        <p className="admin__content-subtitle">
          Создавайте коды для блогеров, посевов или акций. Скидка применяется на этапе оформления заказа, считается на сервере.
        </p>
      </header>

      <div className="promo-admin-form">
        <label className="promo-admin-form__field">
          <span className="promo-admin-form__label">Код</span>
          <input
            placeholder="PAVEL10"
            value={draft.code ?? ''}
            maxLength={32}
            onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
          />
        </label>
        <label className="promo-admin-form__field promo-admin-form__field--narrow">
          <span className="promo-admin-form__label">Тип</span>
          <select
            value={draft.kind ?? 'percent'}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as 'percent' | 'fixed' })}
          >
            <option value="percent">% процент</option>
            <option value="fixed">₽ сумма</option>
          </select>
        </label>
        <label className="promo-admin-form__field promo-admin-form__field--narrow">
          <span className="promo-admin-form__label">Значение</span>
          <input
            type="number"
            placeholder={draft.kind === 'fixed' ? '500' : '10'}
            min={1}
            value={draft.value ?? ''}
            onChange={(e) => setDraft({ ...draft, value: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="promo-admin-form__field">
          <span className="promo-admin-form__label">Мин. сумма корзины</span>
          <input
            type="number"
            placeholder="0"
            min={0}
            value={draft.min_total ?? ''}
            onChange={(e) => setDraft({ ...draft, min_total: Number(e.target.value) || 0 })}
          />
        </label>
        <label className="promo-admin-form__field">
          <span className="promo-admin-form__label">Лимит использований</span>
          <input
            type="number"
            placeholder="∞"
            min={1}
            value={draft.max_uses ?? ''}
            onChange={(e) => setDraft({ ...draft, max_uses: e.target.value ? Number(e.target.value) : null })}
          />
        </label>
        <label className="promo-admin-form__field promo-admin-form__field--wide">
          <span className="promo-admin-form__label">Заметка</span>
          <input
            placeholder="для какого блогера / какой акции"
            value={draft.note ?? ''}
            maxLength={200}
            onChange={(e) => setDraft({ ...draft, note: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="admin__save-btn promo-admin-form__submit"
          onClick={() => void onCreate()}
          disabled={saving || !draft.code?.trim() || !draft.value}
        >
          {saving ? 'сохраняем…' : '+ создать промокод'}
        </button>
      </div>

      {error && <p className="admin__empty-text" style={{ color: 'var(--color-main)' }}>{error}</p>}

      {loading ? (
        <p className="admin__empty-text" style={{ padding: 40 }}>Загрузка…</p>
      ) : rows.length === 0 ? (
        <div className="admin__content-empty">
          <p className="admin__empty-text">Нет промокодов.</p>
        </div>
      ) : (
        <table className="promo-admin-table">
          <thead>
            <tr>
              <th>Код</th>
              <th>Скидка</th>
              <th>Мин. сумма</th>
              <th>Использ.</th>
              <th>Период</th>
              <th>Заметка</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code}>
                <td><code>{r.code}</code></td>
                <td>{r.kind === 'percent' ? `${r.value}%` : `${r.value.toLocaleString('ru-RU')} ₽`}</td>
                <td>{r.min_total ? `${r.min_total.toLocaleString('ru-RU')} ₽` : '—'}</td>
                <td>
                  {r.used_count}{r.max_uses ? ` / ${r.max_uses}` : ''}
                </td>
                <td>
                  {r.valid_from || r.valid_to
                    ? `${r.valid_from ? new Date(r.valid_from).toLocaleDateString('ru-RU') : '—'} — ${r.valid_to ? new Date(r.valid_to).toLocaleDateString('ru-RU') : '—'}`
                    : 'без срока'}
                </td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.note || '—'}</td>
                <td>
                  <button
                    type="button"
                    className="admin__inbox-delete"
                    onClick={() => void onDelete(r.code)}
                  >
                    удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

    </div>
  )
}
