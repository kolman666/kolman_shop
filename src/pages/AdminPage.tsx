import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Product, VariantGroup } from '../data/products'
import { useProducts } from '../hooks/useProducts'
import { variantGroupLabel, VARIANT_GROUP_PRESETS } from '../lib/variantGroups'
import {
  createProduct,
  updateProduct,
  deleteProduct,
  verifyAdminSecret,
  saveAdminSecret,
  clearAdminSecret,
  type ProductInput,
} from '../lib/adminProducts'
import { fetchSiteContent, updateSiteContent } from '../lib/siteContent'
import {
  fetchBloggersAdmin,
  createBlogger,
  updateBlogger,
  deleteBlogger,
  type BloggerRow,
} from '../lib/fetchBloggers'

const CATEGORIES = [
  { key: 'products.categories.mice', label: 'Мышки' },
  { key: 'products.categories.keyboards', label: 'Клавиатуры' },
  { key: 'products.categories.mousepads', label: 'Коврики' },
  { key: 'products.categories.headsets', label: 'Наушники' },
  { key: 'products.categories.glides', label: 'Глайды' },
  { key: 'products.categories.accessories', label: 'Аксессуары' },
]

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(({ key, label }) => [key, label])
)

type FormValues = {
  categoryKey: string
  brand: string
  title: string
  description: string
  image: string
  gallery: string[]
  availability: 'inStock' | 'preorder'
  quantity: string
  specs: string[]
  variantGroups: VariantGroup[]
  price: string
  isFeatured: boolean
}

const BLANK: FormValues = {
  categoryKey: 'products.categories.mice',
  brand: '',
  title: '',
  description: '',
  image: '',
  gallery: [],
  availability: 'inStock',
  quantity: '0',
  specs: [],
  variantGroups: [],
  price: '',
  isFeatured: false,
}

function productToValues(p: Product): FormValues {
  return {
    categoryKey: p.categoryKey,
    brand: p.brand,
    title: p.titleDirect ?? '',
    description: p.descriptionDirect ?? '',
    image: p.image,
    gallery: (p.gallery ?? []).filter((u) => u !== p.image),
    availability: p.availability,
    quantity: String(p.quantity ?? 0),
    specs: p.specs ?? [],
    variantGroups: p.variantGroups ?? [],
    price: String(p.price),
    isFeatured: p.isFeatured ?? false,
  }
}

function formToInput(form: FormValues): ProductInput {
  const galleryFull = form.image
    ? [form.image, ...form.gallery.filter((u) => u !== form.image)]
    : form.gallery
  return {
    brand: form.brand,
    title: form.title,
    description: form.description,
    price: parseFloat(form.price) || 0,
    image: form.image,
    gallery: galleryFull,
    availability: form.availability,
    category_key: form.categoryKey,
    specs: form.specs,
    variant_groups: form.variantGroups,
    is_featured: form.isFeatured,
    quantity: parseInt(form.quantity, 10) || 0,
  }
}

// ── Login screen ──────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }: { onLogin: (secret: string) => Promise<boolean> }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    setLoading(true)
    setError('')
    const ok = await onLogin(value.trim())
    if (!ok) {
      setError('Неверный пароль')
    }
    setLoading(false)
  }

  return (
    <div className="admin">
      <header className="admin__header">
        <div className="admin__logo"><span>kolman</span> admin</div>
        <div className="admin__header-actions">
          <Link to="/" className="admin__back-link">← На сайт</Link>
        </div>
      </header>
      <div className="admin__login-wrap">
        <form className="admin__login-box" onSubmit={handleSubmit}>
          <h2 className="admin__login-title">Вход в панель управления</h2>
          <div className="admin__field">
            <label className="admin__label">Пароль администратора</label>
            <input
              className="admin__input"
              type="password"
              placeholder="••••••••"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="admin__login-error">{error}</p>}
          <button type="submit" className="admin__save-btn" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Проверяем...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Main admin panel ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_secret')
    if (!stored) {
      setAuthChecking(false)
      return
    }
    verifyAdminSecret(stored).then((ok) => {
      setIsAuthed(ok)
      if (!ok) clearAdminSecret()
      setAuthChecking(false)
    })
  }, [])

  async function handleLogin(secret: string): Promise<boolean> {
    const ok = await verifyAdminSecret(secret)
    if (ok) {
      saveAdminSecret(secret)
      setIsAuthed(true)
    }
    return ok
  }

  if (authChecking) {
    return (
      <div className="admin admin--loading">
        <div className="admin__loading-text">Загрузка...</div>
      </div>
    )
  }

  if (!isAuthed) {
    return <AdminLogin onLogin={handleLogin} />
  }

  return <AdminPanel onLogout={() => { clearAdminSecret(); setIsAuthed(false) }} />
}

type AdminTab = 'products' | 'content' | 'bloggers'

// ── Admin panel inner ─────────────────────────────────────────────────────────
function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const { products: allProducts, loading: productsLoading, refresh } = useProducts()
  const [activeTab, setActiveTab] = useState<AdminTab>('products')

  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormValues>(BLANK)
  const [specInput, setSpecInput] = useState('')
  const [variantGroupName, setVariantGroupName] = useState('')
  const [variantOptionInputs, setVariantOptionInputs] = useState<Record<number, string>>({})
  const [galleryInput, setGalleryInput] = useState('')
  const [search, setSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  const filteredList = search.trim()
    ? allProducts.filter((p) => {
        const q = search.toLowerCase()
        return (
          p.brand.toLowerCase().includes(q) ||
          (p.titleDirect ?? '').toLowerCase().includes(q) ||
          CATEGORY_LABEL[p.categoryKey]?.toLowerCase().includes(q)
        )
      })
    : allProducts

  const inStockCount = allProducts.filter((p) => p.availability === 'inStock').length
  const preorderCount = allProducts.filter((p) => p.availability === 'preorder').length

  function openNew() {
    setEditingId(null)
    setForm(BLANK)
    setSpecInput('')
    setVariantGroupName('')
    setVariantOptionInputs({})
    setGalleryInput('')
    setSaveError('')
    setShowForm(true)
  }

  function openEdit(product: Product) {
    setEditingId(product.id)
    setForm(productToValues(product))
    setSpecInput('')
    setVariantGroupName('')
    setVariantOptionInputs({})
    setGalleryInput('')
    setSaveError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingId(null)
    setSaveError('')
  }

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function addSpec() {
    const trimmed = specInput.trim().replace(/,$/, '')
    if (trimmed && !form.specs.includes(trimmed)) {
      setField('specs', [...form.specs, trimmed])
    }
    setSpecInput('')
  }

  function removeSpec(spec: string) {
    setField('specs', form.specs.filter((s) => s !== spec))
  }

  function addVariantGroup() {
    const name = variantGroupName.trim()
    if (!name) return
    if (form.variantGroups.some((g) => (g.name ?? g.key).toLowerCase() === name.toLowerCase())) return
    setField('variantGroups', [...form.variantGroups, { key: name.toLowerCase().replace(/\s+/g, '_'), label: variantGroupLabel(name), name, options: [] }])
    setVariantGroupName('')
  }

  function addVariantPreset(name: string, options: string[]) {
    if (form.variantGroups.some((g) => (g.name ?? g.key).toLowerCase() === name.toLowerCase())) return
    setField('variantGroups', [...form.variantGroups, { key: name.toLowerCase().replace(/\s+/g, '_'), label: variantGroupLabel(name), name, options }])
  }

  function removeVariantGroup(groupName: string) {
    setField('variantGroups', form.variantGroups.filter((g) => g.name !== groupName))
  }

  function renameVariantGroup(index: number, name: string) {
    const next = [...form.variantGroups]
    next[index] = { ...next[index], name }
    setField('variantGroups', next)
  }

  function addVariantOption(index: number) {
    const raw = (variantOptionInputs[index] ?? '').trim().replace(/,$/, '')
    if (!raw) return
    const next = [...form.variantGroups]
    const options = next[index].options
    if (!options.includes(raw)) {
      next[index] = { ...next[index], options: [...options, raw] }
      setField('variantGroups', next)
    }
    setVariantOptionInputs((prev) => ({ ...prev, [index]: '' }))
  }

  function removeVariantOption(index: number, option: string) {
    const next = [...form.variantGroups]
    next[index] = { ...next[index], options: next[index].options.filter((o) => o !== option) }
    setField('variantGroups', next)
  }

  function addGallery() {
    const trimmed = galleryInput.trim()
    if (trimmed && !form.gallery.includes(trimmed)) {
      setField('gallery', [...form.gallery, trimmed])
    }
    setGalleryInput('')
  }

  function removeGalleryItem(url: string) {
    setField('gallery', form.gallery.filter((u) => u !== url))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')

    try {
      const input = formToInput(form)
      if (editingId !== null) {
        const editingProduct = allProducts.find((p) => p.id === editingId)
        await updateProduct(editingProduct?.dbId ?? editingId, input)
      } else {
        await createProduct(input)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      closeForm()
      await refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteConfirm(id: number) {
    try {
      const target = allProducts.find((p) => p.id === id)
      await deleteProduct(target?.dbId ?? id)
      setDeleteConfirm(null)
      if (editingId === id) closeForm()
      await refresh()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Ошибка удаления')
      setDeleteConfirm(null)
    }
  }

  const editingProduct = editingId !== null ? allProducts.find((p) => p.id === editingId) : null
  const isEditingStatic = false

  return (
    <div className="admin">
      <header className="admin__header">
        <div className="admin__logo"><span>kolman</span> admin</div>
        <div className="admin__header-actions">
          {saved && <span className="admin__saved-toast">Сохранено ✓</span>}
          <Link to="/" className="admin__back-link">← На сайт</Link>
          <button type="button" className="admin__back-link" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </header>

      <div className="admin__tab-bar">
        <button type="button" className={`admin__tab-btn${activeTab === 'products' ? ' active' : ''}`} onClick={() => setActiveTab('products')}>
          Товары
        </button>
        <button type="button" className={`admin__tab-btn${activeTab === 'content' ? ' active' : ''}`} onClick={() => setActiveTab('content')}>
          Контент
        </button>
        <button type="button" className={`admin__tab-btn${activeTab === 'bloggers' ? ' active' : ''}`} onClick={() => setActiveTab('bloggers')}>
          Блогеры
        </button>
      </div>

      {activeTab === 'content' && <ContentTab />}
      {activeTab === 'bloggers' && <BloggersTab allProducts={allProducts} />}

      {activeTab === 'products' && (
      <div className="admin__body">
        {/* SIDEBAR */}
        <aside className="admin__sidebar">
          <div className="admin__sidebar-top">
            <button type="button" className="admin__new-btn" onClick={openNew}>
              + Новый товар
            </button>
            <input
              className="admin__search"
              placeholder="Поиск по товарам..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="admin__stats">
            <div className="admin__stat">
              <span className="admin__stat-label">Всего</span>
              <strong className="admin__stat-value">{allProducts.length}</strong>
            </div>
            <div className="admin__stat">
              <span className="admin__stat-label">В наличии</span>
              <strong className="admin__stat-value">{inStockCount}</strong>
            </div>
            <div className="admin__stat">
              <span className="admin__stat-label">Предзаказ</span>
              <strong className="admin__stat-value">{preorderCount}</strong>
            </div>
          </div>

          <ul className="admin__list">
            {productsLoading && (
              <li className="admin__list-loading">Загрузка товаров...</li>
            )}
            {filteredList.map((product) => {
              const title = product.titleDirect ?? product.brand
              const categoryLabel = CATEGORY_LABEL[product.categoryKey] ?? '—'
              return (
                <li
                  key={product.id}
                  className={`admin__list-item${editingId === product.id ? ' active' : ''}`}
                  onClick={() => openEdit(product)}
                >
                  {product.image ? (
                    <img
                      className="admin__list-thumb"
                      src={product.image}
                      alt={title}
                      onError={(e) => { ;(e.target as HTMLImageElement).style.opacity = '0' }}
                    />
                  ) : (
                    <div className="admin__list-thumb admin__list-thumb--empty" />
                  )}
                  <div className="admin__list-info">
                    <span className="admin__list-name">{title}</span>
                    <span className="admin__list-meta">
                      {categoryLabel} · {product.price.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                  <div className="admin__list-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="admin__icon-btn"
                      onClick={() => openEdit(product)}
                      title="Редактировать"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    {product.isAdminCreated && (
                      <button
                        type="button"
                        className="admin__icon-btn admin__icon-btn--danger"
                        onClick={() => setDeleteConfirm(product.id)}
                        title="Удалить"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" />
                          <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* MAIN */}
        <main className="admin__main">
          {showForm ? (
            <form className="admin__form" onSubmit={handleSubmit}>
              <h2 className="admin__form-title">
                {editingId !== null ? 'Редактировать товар' : 'Новый товар'}
                {isEditingStatic && (
                  <span className="admin__form-title-hint">
                    (статический — создаётся копия в Supabase)
                  </span>
                )}
              </h2>

              {/* Основная информация */}
              <div className="admin__form-section">
                <p className="admin__form-section-title">Основная информация</p>
                <div className="admin__two-col">
                  <div className="admin__field">
                    <label className="admin__label">Тип товара *</label>
                    <select
                      className="admin__select"
                      value={form.categoryKey}
                      onChange={(e) => setField('categoryKey', e.target.value)}
                    >
                      {CATEGORIES.map(({ key, label }) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin__field">
                    <label className="admin__label">Бренд *</label>
                    <input
                      className="admin__input"
                      type="text"
                      placeholder="WLMOUSE, CIDOO..."
                      value={form.brand}
                      onChange={(e) => setField('brand', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="admin__field">
                  <label className="admin__label">Название *</label>
                  <input
                    className="admin__input"
                    type="text"
                    placeholder="WLMOUSE Beast X Pro"
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    required
                  />
                </div>
                <div className="admin__field">
                  <label className="admin__label">Описание</label>
                  <textarea
                    className="admin__textarea"
                    rows={3}
                    placeholder="Краткое описание товара..."
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                  />
                </div>
              </div>

              {/* Фото */}
              <div className="admin__form-section">
                <p className="admin__form-section-title">Фото</p>
                <div className="admin__field">
                  <label className="admin__label">
                    Главное фото (URL){' '}
                    <span className="admin__label-hint">(рекомендуемый размер: 800×600 px)</span>
                  </label>
                  <div className="admin__image-field">
                    <input
                      className="admin__input"
                      type="url"
                      placeholder="https://example.com/product.jpg"
                      value={form.image}
                      onChange={(e) => setField('image', e.target.value)}
                    />
                    {form.image ? (
                      <img className="admin__image-preview" src={form.image} alt="preview" />
                    ) : (
                      <div className="admin__image-preview admin__image-preview--empty">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <polyline points="21 15 16 10 5 21" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
                <div className="admin__field">
                  <label className="admin__label">
                    Галерея{' '}
                    <span className="admin__label-hint">(дополнительные фото, рекомендуемый размер: 800×600 px)</span>
                  </label>
                  {form.gallery.length > 0 && (
                    <div className="admin__gallery-list">
                      {form.gallery.map((url, idx) => (
                        <div key={idx} className="admin__gallery-row">
                          <input
                            className="admin__input"
                            type="url"
                            value={url}
                            onChange={(e) => {
                              const next = [...form.gallery]
                              next[idx] = e.target.value
                              setField('gallery', next)
                            }}
                          />
                          <button type="button" className="admin__icon-btn admin__icon-btn--danger" onClick={() => removeGalleryItem(url)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="admin__spec-input-row">
                    <input
                      className="admin__input"
                      type="url"
                      placeholder="https://example.com/photo2.jpg"
                      value={galleryInput}
                      onChange={(e) => setGalleryInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGallery() } }}
                    />
                    <button type="button" className="admin__spec-add-btn" onClick={addGallery}>+ Добавить</button>
                  </div>
                </div>
              </div>

              {/* Наличие */}
              <div className="admin__form-section">
                <p className="admin__form-section-title">Наличие</p>
                <div className="admin__two-col">
                  <div className="admin__field">
                    <label className="admin__label">Статус *</label>
                    <select
                      className="admin__select"
                      value={form.availability}
                      onChange={(e) => setField('availability', e.target.value as 'inStock' | 'preorder')}
                    >
                      <option value="inStock">В наличии</option>
                      <option value="preorder">Предзаказ</option>
                    </select>
                  </div>
                  <div className="admin__field">
                    <label className="admin__label">Количество (шт.)</label>
                    <input
                      className="admin__input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={form.quantity}
                      onChange={(e) => setField('quantity', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Характеристики */}
              <div className="admin__form-section">
                <p className="admin__form-section-title">Ключевые характеристики</p>
                <div className="admin__field">
                  <label className="admin__label">
                    Теги <span className="admin__label-hint">(Enter или запятая — добавить)</span>
                  </label>
                  {form.specs.length > 0 && (
                    <div className="admin__specs">
                      {form.specs.map((spec) => (
                        <span key={spec} className="admin__spec-tag">
                          {spec}
                          <button type="button" className="admin__spec-remove" onClick={() => removeSpec(spec)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="admin__spec-input-row">
                    <input
                      className="admin__input"
                      type="text"
                      placeholder="PAW3395, 8K Hz, 39g..."
                      value={specInput}
                      onChange={(e) => setSpecInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSpec() }
                      }}
                    />
                    <button type="button" className="admin__spec-add-btn" onClick={addSpec}>+ Добавить</button>
                  </div>
                </div>
              </div>

              <div className="admin__form-section">
                <p className="admin__form-section-title">Вариативности товара</p>
                <p className="admin__label-hint">Примеры: Color → {variantGroupLabel('color')}, Size → {variantGroupLabel('size')}, Switches → {variantGroupLabel('switches')}.</p>
                <div className="admin__specs">
                  {VARIANT_GROUP_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      className="admin__spec-tag"
                      onClick={() => addVariantPreset(preset.name ?? preset.key, preset.options)}
                    >
                      + {variantGroupLabel(preset.name ?? preset.key)}
                    </button>
                  ))}
                </div>
                {form.variantGroups.length > 0 && (
                  <div className="admin__gallery-list">
                    {form.variantGroups.map((group, index) => (
                      <div key={`${group.name ?? group.key}-${index}`} className="admin__field">
                        <div className="admin__gallery-row">
                          <input
                            className="admin__input"
                            type="text"
                            value={group.name ?? group.key}
                            onChange={(e) => renameVariantGroup(index, e.target.value)}
                            placeholder="Название вариативности"
                          />
                          <button type="button" className="admin__icon-btn admin__icon-btn--danger" onClick={() => removeVariantGroup(group.name ?? group.key)}>×</button>
                        </div>
                        {group.options.length > 0 && (
                          <div className="admin__specs">
                            {group.options.map((option) => (
                              <span key={`${group.name ?? group.key}-${option}`} className="admin__spec-tag">
                                {option}
                                <button type="button" className="admin__spec-remove" onClick={() => removeVariantOption(index, option)}>×</button>
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="admin__spec-input-row">
                          <input
                            className="admin__input"
                            type="text"
                            placeholder="Добавить вариант"
                            value={variantOptionInputs[index] ?? ''}
                            onChange={(e) => setVariantOptionInputs((prev) => ({ ...prev, [index]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addVariantOption(index) }
                            }}
                          />
                          <button type="button" className="admin__spec-add-btn" onClick={() => addVariantOption(index)}>+ Добавить</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="admin__spec-input-row">
                  <input
                    className="admin__input"
                    type="text"
                    placeholder="Новая вариативность (например, Color)"
                    value={variantGroupName}
                    onChange={(e) => setVariantGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); addVariantGroup() }
                    }}
                  />
                  <button type="button" className="admin__spec-add-btn" onClick={addVariantGroup}>+ Добавить группу</button>
                </div>
              </div>

              {/* Цена */}
              <div className="admin__form-section">
                <p className="admin__form-section-title">Цена и отображение</p>
                <div className="admin__two-col">
                  <div className="admin__field">
                    <label className="admin__label">Цена (RUB) *</label>
                    <input
                      className="admin__input"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="13990"
                      value={form.price}
                      onChange={(e) => setField('price', e.target.value)}
                      required
                    />
                  </div>
                  <div className="admin__field">
                    <label className="admin__label">Рекомендованный</label>
                    <label className="admin__checkbox-field">
                      <input
                        type="checkbox"
                        className="admin__checkbox-input"
                        checked={form.isFeatured}
                        onChange={(e) => setField('isFeatured', e.target.checked)}
                      />
                      <span className="admin__checkbox-label">Показывать на главной</span>
                    </label>
                  </div>
                </div>
              </div>

              {saveError && (
                <div className="admin__save-error">{saveError}</div>
              )}

              <div className="admin__form-actions">
                <button type="button" className="admin__cancel-btn" onClick={closeForm} disabled={saving}>
                  Отмена
                </button>
                {editingId !== null && editingProduct?.isAdminCreated && (
                  <button
                    type="button"
                    className="admin__delete-btn"
                    onClick={() => setDeleteConfirm(editingId)}
                    disabled={saving}
                  >
                    Удалить товар
                  </button>
                )}
                <button type="submit" className="admin__save-btn" disabled={saving}>
                  {saving ? 'Сохраняем...' : editingId !== null && !isEditingStatic ? 'Сохранить изменения' : 'Создать товар'}
                </button>
              </div>
            </form>
          ) : (
            <div className="admin__empty">
              <svg className="admin__empty-icon" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <p className="admin__empty-text">Выберите товар или создайте новый</p>
              <button type="button" className="admin__new-btn admin__new-btn--auto" onClick={openNew}>
                + Создать товар
              </button>
            </div>
          )}
        </main>
      </div>

      )} {/* end products tab */}

      {deleteConfirm !== null && (
        <div className="admin__confirm">
          <div className="admin__confirm-overlay" onClick={() => setDeleteConfirm(null)} />
          <div className="admin__confirm-box">
            <h3>Удалить товар?</h3>
            <p>Это действие нельзя отменить. Товар будет удалён из базы данных.</p>
            <div className="admin__confirm-actions">
              <button type="button" className="admin__cancel-btn" onClick={() => setDeleteConfirm(null)}>Отмена</button>
              <button type="button" className="admin__confirm-delete" onClick={() => void handleDeleteConfirm(deleteConfirm)}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Content Tab ───────────────────────────────────────────────────────────────
type HeroSlide = { tag: string; title: string; subtitle: string; accent: string; image: string }
const BLANK_SLIDE: HeroSlide = { tag: '', title: '', subtitle: '', accent: '', image: '' }

const DEFAULT_SLIDES: HeroSlide[] = [
  { tag: 'новинка', title: 'atk gear ghost ultimate', subtitle: 'бескомпромиссная игровая мышь с уникальным дизайном', accent: 'никаких компромиссов в производительности', image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80' },
  { tag: 'хит продаж', title: 'razer viper v4 pro', subtitle: 'ультралегкая беспроводная имба', accent: 'оптический сенсор 50k dpi', image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80' },
  { tag: 'лимитка', title: 'logitech g pro superlight 2 yellow edition', subtitle: 'создана вместе с киберспортсменами со всего мира', accent: 'сенсор hero 25600 внутри', image: 'https://images.unsplash.com/photo-1563297007-0686b7003af7?w=800&q=80' },
]

const MIGRATION_SQL = `-- Запустите этот SQL в Supabase → SQL Editor
CREATE TABLE IF NOT EXISTS site_content (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bloggers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  image TEXT NOT NULL DEFAULT '',
  social_url TEXT NOT NULL DEFAULT '',
  gear_product_ids INTEGER[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`

function MigrationNotice() {
  const [copied, setCopied] = useState(false)
  function copy() {
    void navigator.clipboard.writeText(MIGRATION_SQL)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="admin__migration-notice">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-main)" strokeWidth="1.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <div>
        <p className="admin__migration-title">Таблицы не созданы</p>
        <p className="admin__migration-text">
          Запустите SQL миграцию в{' '}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="admin__migration-link">
            Supabase → SQL Editor
          </a>
          , после чего обновите страницу.
        </p>
        <pre className="admin__migration-sql">{MIGRATION_SQL}</pre>
        <button type="button" className="admin__save-btn" style={{ marginTop: 10 }} onClick={copy}>
          {copied ? 'Скопировано ✓' : 'Скопировать SQL'}
        </button>
      </div>
    </div>
  )
}

type ContentCategory = { catalogKey: string; title: string; image: string }
type ContentPerk = { title: string; desc: string }

const CATEGORY_KEYS = [
  'products.categories.mice',
  'products.categories.mousepads',
  'products.categories.keyboards',
  'products.categories.headsets',
  'products.categories.glides',
  'products.categories.accessories',
]
const CATEGORY_KEY_LABELS: Record<string, string> = {
  'products.categories.mice': 'мышки',
  'products.categories.mousepads': 'коврики',
  'products.categories.keyboards': 'клавиатуры',
  'products.categories.headsets': 'наушники',
  'products.categories.glides': 'глайды / грипсы',
  'products.categories.accessories': 'аксессуары',
}
const DEFAULT_CATEGORIES: ContentCategory[] = [
  { catalogKey: 'products.categories.mice', title: 'мышки', image: 'https://polzarium.ru/content/images/2025/05/0-7.jpg' },
  { catalogKey: 'products.categories.mousepads', title: 'коврики', image: 'https://ae01.alicdn.com/kf/Sdf5307d2047f4386b59dde83ff7df080r.png' },
  { catalogKey: 'products.categories.keyboards', title: 'клавиатуры', image: 'https://iqunix.com/cdn/shop/files/07_ef9ac2e6-4b41-471b-af02-4b537819110b.jpg?v=1765951802&width=1946' },
  { catalogKey: 'products.categories.headsets', title: 'наушники', image: 'https://i.ytimg.com/vi/AbOziOlBiMk/maxresdefault.jpg' },
  { catalogKey: 'products.categories.glides', title: 'глайды / грипсы', image: 'https://www.deltamechanics.ru/pictures/product/big/20100_big.jpg' },
  { catalogKey: 'products.categories.accessories', title: 'аксессуары', image: 'https://fbi.cults3d.com/uploaders/14107503/illustration-file/1080cada-90f7-4eef-a8fe-a112bfde6460/cyberpunk_edgerunners_keycaps_04.jpg' },
]
const DEFAULT_PERKS: ContentPerk[] = [
  { title: 'гарантия качества', desc: 'каждая позиция в каталоге проходит тщательное тестирование перед тем, как попасть к вам. гарантийное обслуживание и поддержка специалистов включены.' },
  { title: 'быстрая доставка по стране', desc: 'средний срок доставки составляет 3 рабочих дня. отправляем через CDEK с трекингом и уведомлениями на каждом этапе.' },
  { title: '0 фейковых отзывов', desc: 'реальная обратная связь от игроков, которые уже протестировали наше железо. доверие и честная рекомендация для нас важнее громких обещаний.' },
]

function ContentTab() {
  const [slides, setSlides] = useState<HeroSlide[]>(DEFAULT_SLIDES)
  const [categories, setCategories] = useState<ContentCategory[]>(DEFAULT_CATEGORIES)
  const [perks, setPerks] = useState<ContentPerk[]>(DEFAULT_PERKS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null) // which section is saving
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchSiteContent<HeroSlide[]>('hero_slides'),
      fetchSiteContent<ContentCategory[]>('homepage_categories'),
      fetchSiteContent<ContentPerk[]>('homepage_perks'),
    ]).then(([slidesResult, catsResult, perksResult]) => {
      if (slidesResult.needsMigration || catsResult.needsMigration || perksResult.needsMigration) {
        setNeedsMigration(true)
      } else {
        if (!slidesResult.error && slidesResult.data && slidesResult.data.length > 0) setSlides(slidesResult.data)
        if (!catsResult.error && catsResult.data && catsResult.data.length > 0) setCategories(catsResult.data)
        if (!perksResult.error && perksResult.data && perksResult.data.length > 0) setPerks(perksResult.data)
      }
      setLoading(false)
    })
  }, [])

  async function saveSection(key: string, data: unknown) {
    setSaving(key)
    setError('')
    try {
      await updateSiteContent(key, data)
      setSaved(key)
      setTimeout(() => setSaved(null), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(null)
    }
  }

  function updateSlide(index: number, field: keyof HeroSlide, value: string) {
    setSlides((prev) => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  function addSlide() {
    setSlides((prev) => [...prev, { ...BLANK_SLIDE }])
  }

  function removeSlide(index: number) {
    setSlides((prev) => prev.filter((_, i) => i !== index))
  }


  if (loading) {
    return (
      <div className="admin__content-tab admin__content-tab--empty">
        <svg className="admin__empty-icon" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
        </svg>
        <p className="admin__empty-text">Загрузка контента...</p>
      </div>
    )
  }

  if (needsMigration) {
    return <div className="admin__content-tab"><MigrationNotice /></div>
  }

  function SectionHeader({ title, sectionKey }: { title: string; sectionKey: string; }) {
    return (
      <div className="admin__content-header">
        <h2 className="admin__content-title">{title}</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {saved === sectionKey && <span className="admin__saved-toast">Сохранено ✓</span>}
          {error && <span style={{ color: 'var(--color-main)', fontSize: 13 }}>{error}</span>}
          <button
            type="button"
            className="admin__save-btn"
            onClick={() => {
              if (sectionKey === 'hero_slides') void saveSection('hero_slides', slides)
              if (sectionKey === 'homepage_categories') void saveSection('homepage_categories', categories)
              if (sectionKey === 'homepage_perks') void saveSection('homepage_perks', perks)
            }}
            disabled={saving !== null}
          >
            {saving === sectionKey ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin__content-tab">

      {/* ── Hero slides ── */}
      <SectionHeader title="Главный баннер" sectionKey="hero_slides" />

      {slides.length === 0 ? (
        <div className="admin__content-empty">
          <svg className="admin__empty-icon" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <p className="admin__empty-text">Нет слайдов баннера</p>
          <button type="button" className="admin__new-btn admin__new-btn--auto" onClick={addSlide}>
            + Добавить слайд
          </button>
        </div>
      ) : (
        <>
          <div className="admin__slides-list">
            {slides.map((slide, index) => (
              <div key={index} className="admin__slide-card">
                <div className="admin__slide-card-header">
                  <span className="admin__slide-num">Слайд {index + 1}</span>
                  <button type="button" className="admin__icon-btn admin__icon-btn--danger" onClick={() => removeSlide(index)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                  </button>
                </div>
                <div className="admin__two-col">
                  <div className="admin__field">
                    <label className="admin__label">Тег</label>
                    <input className="admin__input" value={slide.tag} onChange={(e) => updateSlide(index, 'tag', e.target.value)} placeholder="новинка" />
                  </div>
                  <div className="admin__field">
                    <label className="admin__label">Заголовок</label>
                    <input className="admin__input" value={slide.title} onChange={(e) => updateSlide(index, 'title', e.target.value)} placeholder="название продукта" />
                  </div>
                </div>
                <div className="admin__field">
                  <label className="admin__label">Подзаголовок</label>
                  <input className="admin__input" value={slide.subtitle} onChange={(e) => updateSlide(index, 'subtitle', e.target.value)} placeholder="краткое описание" />
                </div>
                <div className="admin__field">
                  <label className="admin__label">Акцентный текст</label>
                  <input className="admin__input" value={slide.accent} onChange={(e) => updateSlide(index, 'accent', e.target.value)} placeholder="короткая фраза-акцент" />
                </div>
                <div className="admin__field">
                  <label className="admin__label">Фото (URL)</label>
                  <div className="admin__image-field">
                    <input className="admin__input" type="url" value={slide.image} onChange={(e) => updateSlide(index, 'image', e.target.value)} placeholder="https://..." />
                    {slide.image ? (
                      <img className="admin__image-preview" src={slide.image} alt="preview" />
                    ) : (
                      <div className="admin__image-preview admin__image-preview--empty">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="admin__spec-add-btn" style={{ marginTop: 4 }} onClick={addSlide}>
            + Добавить слайд
          </button>
        </>
      )}

      {/* ── Categories ── */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 28, marginTop: 8 }}>
        <SectionHeader title="Категории на главной" sectionKey="homepage_categories" />
        <p className="admin__label-hint" style={{ marginBottom: 16 }}>Заголовок и фото для каждой из 6 категорий на главной странице.</p>
        <div className="admin__slides-list">
          {categories.map((cat, i) => (
            <div key={i} className="admin__slide-card">
              <div className="admin__slide-card-header">
                <span className="admin__slide-num">Категория {i + 1}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-ghost)' }}>{CATEGORY_KEY_LABELS[cat.catalogKey] ?? cat.catalogKey}</span>
              </div>
              <div className="admin__two-col">
                <div className="admin__field">
                  <label className="admin__label">Тип</label>
                  <select
                    className="admin__select"
                    value={cat.catalogKey}
                    onChange={(e) => setCategories((prev) => prev.map((c, idx) => idx === i ? { ...c, catalogKey: e.target.value } : c))}
                  >
                    {CATEGORY_KEYS.map((k) => (
                      <option key={k} value={k}>{CATEGORY_KEY_LABELS[k] ?? k}</option>
                    ))}
                  </select>
                </div>
                <div className="admin__field">
                  <label className="admin__label">Название</label>
                  <input
                    className="admin__input"
                    value={cat.title}
                    onChange={(e) => setCategories((prev) => prev.map((c, idx) => idx === i ? { ...c, title: e.target.value } : c))}
                    placeholder="мышки"
                  />
                </div>
              </div>
              <div className="admin__field">
                <label className="admin__label">Фото (URL)</label>
                <div className="admin__image-field">
                  <input
                    className="admin__input"
                    type="url"
                    value={cat.image}
                    onChange={(e) => setCategories((prev) => prev.map((c, idx) => idx === i ? { ...c, image: e.target.value } : c))}
                    placeholder="https://..."
                  />
                  {cat.image
                    ? <img className="admin__image-preview" src={cat.image} alt="preview" onError={(e) => { ;(e.target as HTMLImageElement).style.opacity = '0' }} />
                    : <div className="admin__image-preview admin__image-preview--empty"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg></div>
                  }
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Perks / Advantages ── */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 28, marginTop: 8 }}>
        <SectionHeader title="Преимущества" sectionKey="homepage_perks" />
        <p className="admin__label-hint" style={{ marginBottom: 16 }}>3 карточки преимуществ под слайдером.</p>
        <div className="admin__slides-list">
          {perks.map((perk, i) => (
            <div key={i} className="admin__slide-card">
              <div className="admin__slide-card-header">
                <span className="admin__slide-num">Преимущество {i + 1}</span>
              </div>
              <div className="admin__field">
                <label className="admin__label">Заголовок</label>
                <input
                  className="admin__input"
                  value={perk.title}
                  onChange={(e) => setPerks((prev) => prev.map((p, idx) => idx === i ? { ...p, title: e.target.value } : p))}
                  placeholder="гарантия качества"
                />
              </div>
              <div className="admin__field">
                <label className="admin__label">Описание</label>
                <textarea
                  className="admin__textarea"
                  rows={3}
                  value={perk.desc}
                  onChange={(e) => setPerks((prev) => prev.map((p, idx) => idx === i ? { ...p, desc: e.target.value } : p))}
                  placeholder="краткое описание преимущества..."
                />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ── Bloggers Tab ──────────────────────────────────────────────────────────────
type BloggerForm = {
  name: string
  description: string
  image: string
  social_url: string
  gear_product_ids: number[]
  is_active: boolean
  sort_order: string
}

const BLANK_BLOGGER: BloggerForm = {
  name: '', description: '', image: '', social_url: '', gear_product_ids: [], is_active: true, sort_order: '0',
}

function bloggerToForm(b: BloggerRow): BloggerForm {
  return {
    name: b.name,
    description: b.description,
    image: b.image,
    social_url: b.social_url,
    gear_product_ids: b.gear_product_ids,
    is_active: b.is_active,
    sort_order: String(b.sort_order),
  }
}

function BloggersTab({ allProducts }: { allProducts: Product[] }) {
  const [bloggers, setBloggers] = useState<BloggerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<BloggerForm>(BLANK_BLOGGER)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const loadBloggers = async () => {
    setLoading(true)
    const result = await fetchBloggersAdmin(false)
    if (result.needsMigration) {
      setNeedsMigration(true)
    } else {
      setBloggers(result.data)
    }
    setLoading(false)
  }

  useEffect(() => { void loadBloggers() }, [])

  function openNew() {
    setEditingId(null)
    setForm(BLANK_BLOGGER)
    setSaveError('')
    setShowForm(true)
  }

  function openEdit(b: BloggerRow) {
    setEditingId(b.id)
    setForm(bloggerToForm(b))
    setSaveError('')
    setShowForm(true)
  }

  function setField<K extends keyof BloggerForm>(key: K, value: BloggerForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleGearProduct(dbId: number) {
    setForm((prev) => {
      const ids = prev.gear_product_ids.includes(dbId)
        ? prev.gear_product_ids.filter((id) => id !== dbId)
        : [...prev.gear_product_ids, dbId]
      return { ...prev, gear_product_ids: ids }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const input = {
        name: form.name,
        description: form.description,
        image: form.image,
        social_url: form.social_url,
        gear_product_ids: form.gear_product_ids,
        is_active: form.is_active,
        sort_order: parseInt(form.sort_order, 10) || 0,
      }
      if (editingId !== null) {
        await updateBlogger(editingId, input)
      } else {
        await createBlogger(input)
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      setShowForm(false)
      setEditingId(null)
      await loadBloggers()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteBlogger(id)
      setDeleteConfirm(null)
      if (editingId === id) { setShowForm(false); setEditingId(null) }
      await loadBloggers()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Ошибка удаления')
      setDeleteConfirm(null)
    }
  }

  if (needsMigration) {
    return <div className="admin__content-tab"><MigrationNotice /></div>
  }

  return (
    <div className="admin__body">
      <aside className="admin__sidebar">
        <div className="admin__sidebar-top">
          <button type="button" className="admin__new-btn" onClick={openNew}>+ Новый блогер</button>
        </div>

        <div className="admin__stats">
          <div className="admin__stat"><span className="admin__stat-label">Всего</span><strong className="admin__stat-value">{bloggers.length}</strong></div>
          <div className="admin__stat"><span className="admin__stat-label">Активных</span><strong className="admin__stat-value">{bloggers.filter((b) => b.is_active).length}</strong></div>
        </div>
        <ul className="admin__list">
          {loading && <li className="admin__list-loading">Загрузка...</li>}
          {!loading && bloggers.length === 0 && (
            <li style={{ padding: '16px', textAlign: 'center', color: 'var(--color-text-ghost)', fontSize: 13 }}>
              Нет блогеров
            </li>
          )}
          {bloggers.map((b) => (
            <li
              key={b.id}
              className={`admin__list-item${editingId === b.id ? ' active' : ''}`}
              onClick={() => openEdit(b)}
            >
              {b.image ? (
                <img className="admin__list-thumb" src={b.image} alt={b.name} onError={(e) => { ;(e.target as HTMLImageElement).style.opacity = '0' }} />
              ) : (
                <div className="admin__list-thumb admin__list-thumb--empty" />
              )}
              <div className="admin__list-info">
                <span className="admin__list-name">{b.name}</span>
                <span className="admin__list-meta">{b.is_active ? 'активен' : 'скрыт'} · сортировка: {b.sort_order}</span>
              </div>
              <div className="admin__list-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="admin__icon-btn" onClick={() => openEdit(b)} title="Редактировать">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button type="button" className="admin__icon-btn admin__icon-btn--danger" onClick={() => setDeleteConfirm(b.id)} title="Удалить">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </aside>

      <main className="admin__main">
        {showForm ? (
          <form className="admin__form" onSubmit={(e) => { void handleSubmit(e) }}>
            <h2 className="admin__form-title">{editingId !== null ? 'Редактировать блогера' : 'Новый блогер'}</h2>
            {saved && <span className="admin__saved-toast" style={{ display: 'block', marginBottom: 12 }}>Сохранено ✓</span>}

            <div className="admin__form-section">
              <p className="admin__form-section-title">Основная информация</p>
              <div className="admin__two-col">
                <div className="admin__field">
                  <label className="admin__label">Имя / Ник *</label>
                  <input className="admin__input" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="shadowkekw" required />
                </div>
                <div className="admin__field">
                  <label className="admin__label">Ссылка (соцсети / канал)</label>
                  <input className="admin__input" type="url" value={form.social_url} onChange={(e) => setField('social_url', e.target.value)} placeholder="https://t.me/..." />
                </div>
              </div>
              <div className="admin__field">
                <label className="admin__label">Описание</label>
                <textarea className="admin__textarea" rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Краткое описание блогера..." />
              </div>
            </div>

            <div className="admin__form-section">
              <p className="admin__form-section-title">Фото</p>
              <div className="admin__field">
                <label className="admin__label">URL фото <span className="admin__label-hint">(фон карточки, рекомендуется 600×400 px)</span></label>
                <div className="admin__image-field">
                  <input className="admin__input" type="url" value={form.image} onChange={(e) => setField('image', e.target.value)} placeholder="https://..." />
                  {form.image ? (
                    <img className="admin__image-preview" src={form.image} alt="preview" />
                  ) : (
                    <div className="admin__image-preview admin__image-preview--empty">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="admin__form-section">
              <p className="admin__form-section-title">Сетап блогера</p>
              <p className="admin__label-hint">Отметьте товары из каталога, которые использует этот блогер. Они появятся в карточке на главной.</p>
              {allProducts.length === 0 ? (
                <p style={{ color: 'var(--color-text-ghost)', fontSize: 13 }}>Нет товаров в каталоге</p>
              ) : (
                <div className="admin__gear-list">
                  {allProducts.map((p) => {
                    const isSelected = p.dbId !== undefined && form.gear_product_ids.includes(p.dbId)
                    return (
                      <label key={p.id} className={`admin__gear-item${isSelected ? ' selected' : ''}`}>
                        <input
                          type="checkbox"
                          className="admin__checkbox-input"
                          checked={isSelected}
                          onChange={() => p.dbId !== undefined && toggleGearProduct(p.dbId)}
                        />
                        {p.image && <img src={p.image} alt="" className="admin__gear-thumb" onError={(e) => { ;(e.target as HTMLImageElement).style.display = 'none' }} />}
                        <span className="admin__gear-name">{p.brand} {p.titleDirect}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="admin__form-section">
              <p className="admin__form-section-title">Настройки отображения</p>
              <div className="admin__two-col">
                <div className="admin__field">
                  <label className="admin__label">Порядок сортировки</label>
                  <input className="admin__input" type="number" min="0" value={form.sort_order} onChange={(e) => setField('sort_order', e.target.value)} />
                </div>
                <div className="admin__field">
                  <label className="admin__label">Видимость</label>
                  <label className="admin__checkbox-field">
                    <input type="checkbox" className="admin__checkbox-input" checked={form.is_active} onChange={(e) => setField('is_active', e.target.checked)} />
                    <span className="admin__checkbox-label">Показывать на сайте</span>
                  </label>
                </div>
              </div>
            </div>

            {saveError && <div className="admin__save-error">{saveError}</div>}
            <div className="admin__form-actions">
              <button type="button" className="admin__cancel-btn" onClick={() => { setShowForm(false); setEditingId(null) }}>Отмена</button>
              {editingId !== null && (
                <button type="button" className="admin__delete-btn" onClick={() => setDeleteConfirm(editingId)}>Удалить</button>
              )}
              <button type="submit" className="admin__save-btn" disabled={saving}>
                {saving ? 'Сохраняем...' : editingId !== null ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </form>
        ) : (
          <div className="admin__empty">
            <svg className="admin__empty-icon" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0116 0" />
            </svg>
            <p className="admin__empty-text">Выберите блогера или создайте нового</p>
            <button type="button" className="admin__new-btn admin__new-btn--auto" onClick={openNew}>+ Создать блогера</button>
          </div>
        )}
      </main>

      {deleteConfirm !== null && (
        <div className="admin__confirm">
          <div className="admin__confirm-overlay" onClick={() => setDeleteConfirm(null)} />
          <div className="admin__confirm-box">
            <h3>Удалить блогера?</h3>
            <p>Блогер будет удалён из базы данных.</p>
            <div className="admin__confirm-actions">
              <button type="button" className="admin__cancel-btn" onClick={() => setDeleteConfirm(null)}>Отмена</button>
              <button type="button" className="admin__confirm-delete" onClick={() => void handleDelete(deleteConfirm)}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

