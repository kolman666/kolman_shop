// Admin CRUD for promo codes. Reads from /api/orders?promos=1, mutates via
// POST/DELETE on the same endpoint. Codes are short (≤ 32 chars) so editing
// inline is fine — no separate "edit" form, just upsert on save.

import { useEffect, useState } from 'react'
import { fetchSiteContent, updateSiteContent } from '../../lib/siteContent'
import { useProducts } from '../../hooks/useProducts'

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

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

async function deletePromo(code: string) {
  const r = await fetch('/api/orders?promo=1', {
    method: 'DELETE',
    headers: adminHeaders(),
    body: JSON.stringify({ code }),
  })
  if (!r.ok) throw new Error(`${r.status}`)
}

type BannerState = { enabled: boolean; text: string; until: string; url: string; buttonText: string }
const BLANK_BANNER: BannerState = { enabled: false, text: '', until: '', url: '', buttonText: '' }

// Editor for the site-wide flash-sale banner (promo_banner site_content key).
// Rendered by <PromoBanner /> at the top of every page.
function PromoBannerEditor() {
  const [b, setB] = useState<BannerState>(BLANK_BANNER)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchSiteContent<Partial<BannerState>>('promo_banner').then((r) => {
      if (cancelled) return
      if (!r.error && r.data) {
        setB({
          enabled: r.data.enabled === true,
          text: r.data.text ?? '',
          until: r.data.until ?? '',
          url: r.data.url ?? '',
          buttonText: r.data.buttonText ?? '',
        })
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      await updateSiteContent('promo_banner', b)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <div className="promo-admin-banner" style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--color-border)' }}>
      <h3 className="admin__content-title" style={{ fontSize: 16 }}>Баннер акции</h3>
      <p className="admin__content-subtitle">
        Узкая полоса вверху всех страниц с таймером обратного отсчёта. Когда срок выйдет — баннер скроется сам.
      </p>
      <label className="admin__checkbox-field" style={{ margin: '10px 0' }}>
        <input
          type="checkbox"
          className="admin__checkbox-input"
          checked={b.enabled}
          onChange={(e) => setB({ ...b, enabled: e.target.checked })}
        />
        <span className="admin__checkbox-label">Показывать баннер</span>
      </label>
      <div className="promo-admin-form">
        <label className="promo-admin-form__field promo-admin-form__field--wide">
          <span className="promo-admin-form__label">Текст</span>
          <input
            value={b.text}
            maxLength={200}
            placeholder="Чёрная пятница — скидки до 40%"
            onChange={(e) => setB({ ...b, text: e.target.value })}
          />
        </label>
        <label className="promo-admin-form__field">
          <span className="promo-admin-form__label">Отсчёт до</span>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(b.until || null)}
            onChange={(e) => setB({ ...b, until: fromDatetimeLocalValue(e.target.value) ?? '' })}
          />
        </label>
        <label className="promo-admin-form__field">
          <span className="promo-admin-form__label">Ссылка (необязательно)</span>
          <input
            value={b.url}
            maxLength={300}
            placeholder="/catalog или https://…"
            onChange={(e) => setB({ ...b, url: e.target.value })}
          />
        </label>
        <label className="promo-admin-form__field promo-admin-form__field--narrow">
          <span className="promo-admin-form__label">Текст кнопки</span>
          <input
            value={b.buttonText}
            maxLength={60}
            placeholder="В каталог →"
            onChange={(e) => setB({ ...b, buttonText: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="admin__save-btn promo-admin-form__submit"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? 'сохраняем…' : saved ? '✓ сохранено' : 'сохранить баннер'}
        </button>
      </div>
      {error && <p className="admin__empty-text" style={{ color: 'var(--color-main)' }}>{error}</p>}
    </div>
  )
}

type BundleDraft = { title: string; subtitle: string; promoCode: string; image: string; productIds: number[] }
const BLANK_BUNDLE: BundleDraft = { title: '', subtitle: '', promoCode: '', image: '', productIds: [] }

// Editor for "build your setup" bundles (bundles site_content key). Each set
// is 2+ products + an optional promo code that auto-applies in the cart.
function BundlesEditor() {
  const { products } = useProducts()
  const [bundles, setBundles] = useState<BundleDraft[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchSiteContent<Partial<BundleDraft>[]>('bundles').then((r) => {
      if (cancelled) return
      if (!r.error && Array.isArray(r.data)) {
        setBundles(r.data.map((b) => ({
          title: b.title ?? '',
          subtitle: b.subtitle ?? '',
          promoCode: b.promoCode ?? '',
          image: b.image ?? '',
          productIds: Array.isArray(b.productIds) ? b.productIds : [],
        })))
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  function update(idx: number, patch: Partial<BundleDraft>) {
    setBundles((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)))
  }
  function addBundle() { setBundles((prev) => [...prev, { ...BLANK_BUNDLE }]) }
  function removeBundle(idx: number) { setBundles((prev) => prev.filter((_, i) => i !== idx)) }

  async function save() {
    setSaving(true); setError(''); setSaved(false)
    try {
      const payload = bundles
        .map((b) => ({ ...b, promoCode: b.promoCode.trim().toUpperCase() }))
        .filter((b) => b.productIds.length >= 2)
      await updateSiteContent('bundles', payload)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <div className="promo-admin-banner" style={{ marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid var(--color-border)' }}>
      <h3 className="admin__content-title" style={{ fontSize: 16 }}>Комплекты «Соберите сетап»</h3>
      <p className="admin__content-subtitle">
        Наборы из 2+ товаров. Скидку привяжите к промокоду — он применится в корзине автоматически. Показываются блоком на главной.
      </p>
      {bundles.map((b, idx) => (
        <div key={idx} className="promo-admin-form" style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, marginTop: 12 }}>
          <label className="promo-admin-form__field promo-admin-form__field--wide">
            <span className="promo-admin-form__label">Название набора</span>
            <input value={b.title} maxLength={120} placeholder="Старт-сетап для шутеров" onChange={(e) => update(idx, { title: e.target.value })} />
          </label>
          <label className="promo-admin-form__field promo-admin-form__field--wide">
            <span className="promo-admin-form__label">Подпись</span>
            <input value={b.subtitle} maxLength={200} placeholder="мышь + коврик + глайды" onChange={(e) => update(idx, { subtitle: e.target.value })} />
          </label>
          <label className="promo-admin-form__field promo-admin-form__field--narrow">
            <span className="promo-admin-form__label">Промокод скидки</span>
            <input value={b.promoCode} maxLength={32} placeholder="SETUP10" onChange={(e) => update(idx, { promoCode: e.target.value.toUpperCase() })} />
          </label>
          <label className="promo-admin-form__field promo-admin-form__field--wide">
            <span className="promo-admin-form__label">Товары (Ctrl/Cmd — выбрать несколько)</span>
            <select
              multiple
              size={6}
              value={b.productIds.map(String)}
              onChange={(e) => update(idx, { productIds: Array.from(e.target.selectedOptions).map((o) => Number(o.value)) })}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.brand} {p.titleDirect ?? ''} — {p.price.toLocaleString('ru-RU')} ₽
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="admin__inbox-delete" onClick={() => removeBundle(idx)}>удалить набор</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button type="button" className="accordion__btn" onClick={addBundle}>+ добавить набор</button>
        <button type="button" className="admin__save-btn" onClick={() => void save()} disabled={saving}>
          {saving ? 'сохраняем…' : saved ? '✓ сохранено' : 'сохранить комплекты'}
        </button>
      </div>
      {error && <p className="admin__empty-text" style={{ color: 'var(--color-main)' }}>{error}</p>}
    </div>
  )
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
      setDraft({ code: '', kind: 'percent', value: 10, min_total: 0, max_uses: null, valid_from: null, valid_to: null, note: '' })
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

      <PromoBannerEditor />

      <BundlesEditor />

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
        <label className="promo-admin-form__field">
          <span className="promo-admin-form__label">Действует с</span>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(draft.valid_from ?? null)}
            onChange={(e) => setDraft({ ...draft, valid_from: fromDatetimeLocalValue(e.target.value) })}
          />
        </label>
        <label className="promo-admin-form__field">
          <span className="promo-admin-form__label">Действует до</span>
          <input
            type="datetime-local"
            value={toDatetimeLocalValue(draft.valid_to ?? null)}
            onChange={(e) => setDraft({ ...draft, valid_to: fromDatetimeLocalValue(e.target.value) })}
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
        <div className="promo-admin-table-wrap">
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
        </div>
      )}

    </div>
  )
}
