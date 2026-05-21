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
import NewsBlock from '../components/NewsBlock'
import {
  fetchBloggersAdmin,
  createBlogger,
  updateBlogger,
  deleteBlogger,
  type BloggerRow,
} from '../lib/fetchBloggers'
import {
  listOrders,
  updateOrderStatus,
  deleteOrder,
  ORDER_STATUSES,
  type AdminOrder,
  type OrderStatus,
  listInquiries,
  updateInquiryStatus,
  deleteInquiry,
  INQUIRY_STATUSES,
  INQUIRY_CATEGORIES,
  type AdminInquiry,
  type InquiryStatus,
  type InquiryCategory,
} from '../lib/adminInbox'

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
            <span className="admin__label">Пароль администратора</span>
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
type AuthStatus = 'checking' | 'guest' | 'authed'

export default function AdminPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => (
    sessionStorage.getItem('admin_secret') ? 'checking' : 'guest'
  ))

  useEffect(() => {
    const stored = sessionStorage.getItem('admin_secret')
    if (!stored) {
      return
    }
    verifyAdminSecret(stored).then((ok) => {
      if (!ok) clearAdminSecret()
      setAuthStatus(ok ? 'authed' : 'guest')
    })
  }, [])

  async function handleLogin(secret: string): Promise<boolean> {
    const ok = await verifyAdminSecret(secret)
    if (ok) {
      saveAdminSecret(secret)
      setAuthStatus('authed')
    }
    return ok
  }

  if (authStatus === 'checking') {
    return (
      <div className="admin admin--loading">
        <div className="admin__loading-text">Загрузка...</div>
      </div>
    )
  }

  if (authStatus === 'guest') {
    return <AdminLogin onLogin={handleLogin} />
  }

  return <AdminPanel onLogout={() => { clearAdminSecret(); setAuthStatus('guest') }} />
}

type AdminTab = 'products' | 'content' | 'pages' | 'orders' | 'inquiries' | 'bloggers'

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
          Главная
        </button>
        <button type="button" className={`admin__tab-btn${activeTab === 'pages' ? ' active' : ''}`} onClick={() => setActiveTab('pages')}>
          Страницы
        </button>
        <button type="button" className={`admin__tab-btn${activeTab === 'orders' ? ' active' : ''}`} onClick={() => setActiveTab('orders')}>
          Заказы
        </button>
        <button type="button" className={`admin__tab-btn${activeTab === 'inquiries' ? ' active' : ''}`} onClick={() => setActiveTab('inquiries')}>
          Заявки
        </button>
        <button type="button" className={`admin__tab-btn${activeTab === 'bloggers' ? ' active' : ''}`} onClick={() => setActiveTab('bloggers')}>
          Блогеры
        </button>
      </div>

      {activeTab === 'content' && <ContentTab />}
      {activeTab === 'pages' && <PagesTab />}
      {activeTab === 'orders' && <OrdersTab />}
      {activeTab === 'inquiries' && <InquiriesTab />}
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
                    <span className="admin__label">Тип товара *</span>
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
                    <span className="admin__label">Бренд *</span>
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
                  <span className="admin__label">Название *</span>
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
                  <span className="admin__label">Описание</span>
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
                  <span className="admin__label">
                    Главное фото (URL){' '}
                    <span className="admin__label-hint">(рекомендуемый размер: 800×600 px)</span>
                  </span>
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
                  <span className="admin__label">
                    Галерея{' '}
                    <span className="admin__label-hint">(дополнительные фото, рекомендуемый размер: 800×600 px)</span>
                  </span>
                  {form.gallery.length > 0 && (
                    <div className="admin__gallery-list">
                      {form.gallery.map((url, idx) => (
                        <div key={url || 'empty-gallery-url'} className="admin__gallery-row">
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
                    <span className="admin__label">Статус *</span>
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
                    <span className="admin__label">Количество (шт.)</span>
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
                  <span className="admin__label">
                    Теги <span className="admin__label-hint">(Enter или запятая — добавить)</span>
                  </span>
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
                    <span className="admin__label">Цена (RUB) *</span>
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
                    <span className="admin__label">Рекомендованный</span>
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
type HeroSlide = { tag: string; title: string; subtitle: string; accent: string; image: string; detailsUrl?: string }
const BLANK_SLIDE: HeroSlide = { tag: '', title: '', subtitle: '', accent: '', image: '', detailsUrl: '' }

type NewsItemAdmin = {
  id: string
  tag?: string
  date?: string
  readMin?: string
  title: string
  excerpt?: string
  image?: string
  url?: string
}
const BLANK_NEWS: NewsItemAdmin = { id: '', tag: '', date: '', readMin: '', title: '', excerpt: '', image: '', url: '' }
const DEFAULT_NEWS: NewsItemAdmin[] = []

const DEFAULT_SLIDES: HeroSlide[] = [
  { tag: 'новинка', title: 'atk gear ghost ultimate', subtitle: 'бескомпромиссная игровая мышь с уникальным дизайном', accent: 'никаких компромиссов в производительности', image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&q=80', detailsUrl: '' },
  { tag: 'хит продаж', title: 'razer viper v4 pro', subtitle: 'ультралегкая беспроводная имба', accent: 'оптический сенсор 50k dpi', image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800&q=80', detailsUrl: '' },
  { tag: 'лимитка', title: 'logitech g pro superlight 2 yellow edition', subtitle: 'создана вместе с киберспортсменами со всего мира', accent: 'сенсор hero 25600 внутри', image: 'https://images.unsplash.com/photo-1563297007-0686b7003af7?w=800&q=80', detailsUrl: '' },
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
);
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'new',
  customer_name TEXT NOT NULL DEFAULT '',
  customer_contact TEXT NOT NULL DEFAULT '',
  delivery TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status, created_at DESC);
CREATE TABLE IF NOT EXISTS inquiries (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'new',
  customer_name TEXT NOT NULL DEFAULT '',
  customer_contact TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS inquiries_category_idx ON inquiries(category, created_at DESC);`

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

type SearchSectionAdmin = { label: string; catalogKey: string }

type ContentSectionHeaderProps = {
  title: string
  sectionKey: string
  saved: string | null
  error: string
  saving: string | null
  onSave: (sectionKey: string) => void
}

function ContentSectionHeader({ title, sectionKey, saved, error, saving, onSave }: ContentSectionHeaderProps) {
  return (
    <div className="admin__content-header">
      <h2 className="admin__content-title">{title}</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        {saved === sectionKey && <span className="admin__saved-toast">Сохранено ✓</span>}
        {error && <span style={{ color: 'var(--color-main)', fontSize: 13 }}>{error}</span>}
        <button
          type="button"
          className="admin__save-btn"
          onClick={() => onSave(sectionKey)}
          disabled={saving !== null}
        >
          {saving === sectionKey ? 'Сохраняем...' : 'Сохранить'}
        </button>
      </div>
    </div>
  )
}

const DEFAULT_SEARCH_SECTIONS: SearchSectionAdmin[] = [
  { label: 'Клавиатуры', catalogKey: 'products.categories.keyboards' },
  { label: 'Мышки', catalogKey: 'products.categories.mice' },
  { label: 'Коврики', catalogKey: 'products.categories.mousepads' },
  { label: 'Наушники', catalogKey: 'products.categories.headsets' },
  { label: 'Мониторы', catalogKey: '' },
  { label: 'Глайды/Грипсы', catalogKey: 'products.categories.glides' },
  { label: 'Микрофоны', catalogKey: '' },
  { label: 'Кейкапы', catalogKey: '' },
]

type ContentLang = 'ru' | 'en'

function ContentTab() {
  const [contentLang, setContentLang] = useState<ContentLang>('ru')
  const [slides, setSlides] = useState<HeroSlide[]>(DEFAULT_SLIDES)
  const [categories, setCategories] = useState<ContentCategory[]>(DEFAULT_CATEGORIES)
  const [perks, setPerks] = useState<ContentPerk[]>(DEFAULT_PERKS)
  const [news, setNews] = useState<NewsItemAdmin[]>(DEFAULT_NEWS)
  const [searchSections, setSearchSections] = useState<SearchSectionAdmin[]>(DEFAULT_SEARCH_SECTIONS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)

  // Try `${baseKey}_${contentLang}` first, fall back to the legacy unsuffixed key.
  async function loadLocalized<T>(baseKey: string): Promise<{ data: T | null; needsMigration: boolean }> {
    const specific = await fetchSiteContent<T>(`${baseKey}_${contentLang}`)
    if (specific.needsMigration) return { data: null, needsMigration: true }
    if (!specific.error && specific.data && (!Array.isArray(specific.data) || specific.data.length > 0)) {
      return { data: specific.data, needsMigration: false }
    }
    const legacy = await fetchSiteContent<T>(baseKey)
    return { data: legacy.data, needsMigration: legacy.needsMigration }
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      loadLocalized<HeroSlide[]>('hero_slides'),
      loadLocalized<ContentCategory[]>('homepage_categories'),
      loadLocalized<ContentPerk[]>('homepage_perks'),
      loadLocalized<NewsItemAdmin[]>('homepage_news'),
      fetchSiteContent<SearchSectionAdmin[]>('search_popular_sections'),
    ]).then(([slidesResult, catsResult, perksResult, newsResult, searchResult]) => {
      if (slidesResult.needsMigration || catsResult.needsMigration || perksResult.needsMigration) {
        setNeedsMigration(true)
      } else {
        setSlides(slidesResult.data && slidesResult.data.length > 0 ? slidesResult.data : DEFAULT_SLIDES)
        setCategories(catsResult.data && catsResult.data.length > 0 ? catsResult.data : DEFAULT_CATEGORIES)
        setPerks(perksResult.data && perksResult.data.length > 0 ? perksResult.data : DEFAULT_PERKS)
        setNews(newsResult.data && newsResult.data.length > 0 ? newsResult.data : DEFAULT_NEWS)
        if (!searchResult.error && searchResult.data && searchResult.data.length > 0) setSearchSections(searchResult.data)
      }
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentLang])

  // Saves to actualKey but uses uiKey to drive saving/saved indicators in the UI.
  async function saveSection(uiKey: string, actualKey: string, data: unknown) {
    setSaving(uiKey)
    setError('')
    try {
      await updateSiteContent(actualKey, data)
      setSaved(uiKey)
      setTimeout(() => setSaved(null), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(null)
    }
  }

  function saveContentSection(sectionKey: string) {
    const suffix = `_${contentLang}`
    if (sectionKey === 'hero_slides') void saveSection(sectionKey, `hero_slides${suffix}`, slides)
    if (sectionKey === 'homepage_categories') void saveSection(sectionKey, `homepage_categories${suffix}`, categories)
    if (sectionKey === 'homepage_perks') void saveSection(sectionKey, `homepage_perks${suffix}`, perks)
    if (sectionKey === 'homepage_news') void saveSection(sectionKey, `homepage_news${suffix}`, news)
    if (sectionKey === 'search_popular_sections') void saveSection(sectionKey, 'search_popular_sections', searchSections)
  }

  function updateNews(index: number, field: keyof NewsItemAdmin, value: string) {
    setNews((prev) => prev.map((n, i) => i === index ? { ...n, [field]: value } : n))
  }
  function addNews() {
    setNews((prev) => [...prev, { ...BLANK_NEWS, id: `news-${Date.now()}` }])
  }
  function removeNews(index: number) {
    setNews((prev) => prev.filter((_, i) => i !== index))
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

  function addCategory() {
    setCategories((prev) => [...prev, { catalogKey: CATEGORY_KEYS[0] ?? '', title: '', image: '' }])
  }

  function removeCategory(index: number) {
    setCategories((prev) => prev.filter((_, i) => i !== index))
  }

  function addPerk() {
    setPerks((prev) => [...prev, { title: '', desc: '' }])
  }

  function removePerk(index: number) {
    setPerks((prev) => prev.filter((_, i) => i !== index))
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

  return (
    <div className="admin__content-tab">

      {/* ── Language switcher ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span className="admin__label" style={{ margin: 0 }}>Язык контента:</span>
        <div className="admin__lang-tabs">
          {(['ru', 'en'] as const).map((lng) => (
            <button
              key={lng}
              type="button"
              className={`admin__lang-tab ${contentLang === lng ? 'admin__lang-tab--active' : ''}`.trim()}
              onClick={() => setContentLang(lng)}
            >
              {lng.toUpperCase()}
            </button>
          ))}
        </div>
        <span className="admin__label-hint" style={{ margin: 0 }}>
          Сохранение идёт в ключ <code>{`<секция>_${contentLang}`}</code>; если пусто — подгружается legacy/EN.
        </span>
      </div>

      {/* ── Hero slides ── */}
      <ContentSectionHeader title="Главный баннер" sectionKey="hero_slides" saved={saved} error={error} saving={saving} onSave={saveContentSection} />

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
              <div key={`${slide.image}-${slide.title}-${slide.tag}`} className="admin__slide-card">
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
                    <span className="admin__label">Тег</span>
                    <input className="admin__input" value={slide.tag} onChange={(e) => updateSlide(index, 'tag', e.target.value)} placeholder="новинка" />
                  </div>
                  <div className="admin__field">
                    <span className="admin__label">Заголовок</span>
                    <input className="admin__input" value={slide.title} onChange={(e) => updateSlide(index, 'title', e.target.value)} placeholder="название продукта" />
                  </div>
                </div>
                <div className="admin__field">
                  <span className="admin__label">Подзаголовок</span>
                  <input className="admin__input" value={slide.subtitle} onChange={(e) => updateSlide(index, 'subtitle', e.target.value)} placeholder="краткое описание" />
                </div>
                <div className="admin__field">
                  <span className="admin__label">Акцентный текст</span>
                  <input className="admin__input" value={slide.accent} onChange={(e) => updateSlide(index, 'accent', e.target.value)} placeholder="короткая фраза-акцент" />
                </div>
                <div className="admin__field">
                  <span className="admin__label">Фото (URL)</span>
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
                <div className="admin__field">
                  <span className="admin__label">
                    Ссылка кнопки «Подробнее»{' '}
                    <span className="admin__label-hint">(внутренняя: /product/slug или /catalog?category=…, либо https://… — оставьте пустым, чтобы скрыть кнопку)</span>
                  </span>
                  <input
                    className="admin__input"
                    type="text"
                    value={slide.detailsUrl ?? ''}
                    onChange={(e) => updateSlide(index, 'detailsUrl', e.target.value)}
                    placeholder="/product/wlmouse-beast-x-pro  или  https://…"
                  />
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="admin__spec-add-btn" style={{ marginTop: 4 }} onClick={addSlide}>
            + Добавить слайд
          </button>
        </>
      )}

      {/* ── News (homepage blog block) ── */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 28, marginTop: 8 }}>
        <ContentSectionHeader title="Блок новостей на главной" sectionKey="homepage_news" saved={saved} error={error} saving={saving} onSave={saveContentSection} />
        <p className="admin__label-hint" style={{ marginBottom: 16 }}>Карточки в горизонтальном слайдере «Наш блог» на главной. Заполняйте на текущем языке вкладки.</p>
        {news.length === 0 ? (
          <div className="admin__content-empty">
            <p className="admin__empty-text">Новости не добавлены</p>
            <button type="button" className="admin__new-btn admin__new-btn--auto" onClick={addNews}>+ Добавить новость</button>
          </div>
        ) : (
          <>
            <div className="admin__slides-list">
              {news.map((item, index) => (
                <div key={item.id || index} className="admin__slide-card">
                  <div className="admin__slide-card-header">
                    <span className="admin__slide-num">Новость {index + 1}</span>
                    <button type="button" className="admin__icon-btn admin__icon-btn--danger" onClick={() => removeNews(index)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </button>
                  </div>
                  <div className="admin__two-col">
                    <div className="admin__field">
                      <span className="admin__label">ID (уникальный)</span>
                      <input className="admin__input" value={item.id ?? ''} onChange={(e) => updateNews(index, 'id', e.target.value)} placeholder="news-1" />
                    </div>
                    <div className="admin__field">
                      <span className="admin__label">Тег</span>
                      <input className="admin__input" value={item.tag ?? ''} onChange={(e) => updateNews(index, 'tag', e.target.value)} placeholder="обзоры / гайды" />
                    </div>
                  </div>
                  <div className="admin__field">
                    <span className="admin__label">Заголовок</span>
                    <input className="admin__input" value={item.title ?? ''} onChange={(e) => updateNews(index, 'title', e.target.value)} />
                  </div>
                  <div className="admin__field">
                    <span className="admin__label">Краткий текст</span>
                    <input className="admin__input" value={item.excerpt ?? ''} onChange={(e) => updateNews(index, 'excerpt', e.target.value)} />
                  </div>
                  <div className="admin__two-col">
                    <div className="admin__field">
                      <span className="admin__label">Дата (свободный текст)</span>
                      <input className="admin__input" value={item.date ?? ''} onChange={(e) => updateNews(index, 'date', e.target.value)} placeholder="05 мая 2026" />
                    </div>
                    <div className="admin__field">
                      <span className="admin__label">Время чтения</span>
                      <input className="admin__input" value={item.readMin ?? ''} onChange={(e) => updateNews(index, 'readMin', e.target.value)} placeholder="5 мин чтения" />
                    </div>
                  </div>
                  <div className="admin__field">
                    <span className="admin__label">Фото (URL)</span>
                    <div className="admin__image-field">
                      <input className="admin__input" type="url" value={item.image ?? ''} onChange={(e) => updateNews(index, 'image', e.target.value)} placeholder="https://..." />
                      {item.image ? (
                        <img className="admin__image-preview" src={item.image} alt="preview" />
                      ) : (
                        <div className="admin__image-preview admin__image-preview--empty" />
                      )}
                    </div>
                  </div>
                  <div className="admin__field">
                    <span className="admin__label">Ссылка</span>
                    <input className="admin__input" type="text" value={item.url ?? ''} onChange={(e) => updateNews(index, 'url', e.target.value)} placeholder="/catalog или https://..." />
                  </div>
                </div>
              ))}
            </div>
            <button type="button" className="admin__spec-add-btn" style={{ marginTop: 4 }} onClick={addNews}>+ Добавить новость</button>
          </>
        )}

        {news.length > 0 && (
          <div className="admin__preview">
            <span className="admin__preview-label">Превью на сайте</span>
            <NewsBlock items={news} />
          </div>
        )}
      </div>

      {/* ── Categories ── */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 28, marginTop: 8 }}>
        <ContentSectionHeader title="Категории на главной" sectionKey="homepage_categories" saved={saved} error={error} saving={saving} onSave={saveContentSection} />
        <p className="admin__label-hint" style={{ marginBottom: 16 }}>Заголовок, фото и тип для каждой категории. Можно добавлять и удалять.</p>
        {categories.length === 0 ? (
          <div className="admin__content-empty">
            <p className="admin__empty-text">Нет категорий</p>
            <button type="button" className="admin__new-btn admin__new-btn--auto" onClick={addCategory}>
              + Добавить категорию
            </button>
          </div>
        ) : (
          <>
            <div className="admin__slides-list">
              {categories.map((cat, i) => (
                <div key={`${cat.catalogKey}-${cat.title}-${cat.image}`} className="admin__slide-card">
                  <div className="admin__slide-card-header">
                    <span className="admin__slide-num">Категория {i + 1}</span>
                    <button type="button" className="admin__icon-btn admin__icon-btn--danger" onClick={() => removeCategory(i)} title="Удалить категорию">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </button>
                  </div>
                  <div className="admin__two-col">
                    <div className="admin__field">
                      <span className="admin__label">Тип товара</span>
                      <select
                        className="admin__select"
                        value={CATEGORY_KEYS.includes(cat.catalogKey) ? cat.catalogKey : '__custom__'}
                        onChange={(e) => {
                          const v = e.target.value
                          setCategories((prev) => prev.map((c, idx) => idx === i ? { ...c, catalogKey: v === '__custom__' ? c.catalogKey : v } : c))
                        }}
                      >
                        {CATEGORY_KEYS.map((k) => (
                          <option key={k} value={k}>{CATEGORY_KEY_LABELS[k] ?? k}</option>
                        ))}
                        <option value="__custom__">— своё значение —</option>
                      </select>
                      {!CATEGORY_KEYS.includes(cat.catalogKey) && (
                        <input
                          className="admin__input"
                          style={{ marginTop: 6 }}
                          value={cat.catalogKey}
                          onChange={(e) => setCategories((prev) => prev.map((c, idx) => idx === i ? { ...c, catalogKey: e.target.value } : c))}
                          placeholder="my-custom-category"
                        />
                      )}
                    </div>
                    <div className="admin__field">
                      <span className="admin__label">Название</span>
                      <input
                        className="admin__input"
                        value={cat.title}
                        onChange={(e) => setCategories((prev) => prev.map((c, idx) => idx === i ? { ...c, title: e.target.value } : c))}
                        placeholder="мышки"
                      />
                    </div>
                  </div>
                  <div className="admin__field">
                    <span className="admin__label">Фото (URL)</span>
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
            <button type="button" className="admin__spec-add-btn" style={{ marginTop: 4 }} onClick={addCategory}>
              + Добавить категорию
            </button>
          </>
        )}
      </div>

      {/* ── Perks / Advantages ── */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 28, marginTop: 8 }}>
        <ContentSectionHeader title="Преимущества" sectionKey="homepage_perks" saved={saved} error={error} saving={saving} onSave={saveContentSection} />
        <p className="admin__label-hint" style={{ marginBottom: 16 }}>Карточки преимуществ под слайдером. Можно добавлять и удалять.</p>
        {perks.length === 0 ? (
          <div className="admin__content-empty">
            <p className="admin__empty-text">Нет преимуществ</p>
            <button type="button" className="admin__new-btn admin__new-btn--auto" onClick={addPerk}>
              + Добавить преимущество
            </button>
          </div>
        ) : (
          <>
            <div className="admin__slides-list">
              {perks.map((perk, i) => (
                <div key={`${perk.title}-${perk.desc}`} className="admin__slide-card">
                  <div className="admin__slide-card-header">
                    <span className="admin__slide-num">Преимущество {i + 1}</span>
                    <button type="button" className="admin__icon-btn admin__icon-btn--danger" onClick={() => removePerk(i)} title="Удалить преимущество">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </button>
                  </div>
                  <div className="admin__field">
                    <span className="admin__label">Заголовок</span>
                    <input
                      className="admin__input"
                      value={perk.title}
                      onChange={(e) => setPerks((prev) => prev.map((p, idx) => idx === i ? { ...p, title: e.target.value } : p))}
                      placeholder="гарантия качества"
                    />
                  </div>
                  <div className="admin__field">
                    <span className="admin__label">Описание</span>
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
            <button type="button" className="admin__spec-add-btn" style={{ marginTop: 4 }} onClick={addPerk}>
              + Добавить преимущество
            </button>
          </>
        )}
      </div>

      {/* ── Search popular sections ── */}
      <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 28, marginTop: 8 }}>
        <ContentSectionHeader title="Поиск — популярные разделы" sectionKey="search_popular_sections" saved={saved} error={error} saving={saving} onSave={saveContentSection} />
        <p className="admin__label-hint" style={{ marginBottom: 16 }}>
          Чипы, которые отображаются в выпадающем меню поиска под «Популярные разделы». Оставьте catalogKey пустым, чтобы вести просто в каталог.
        </p>
        <div className="admin__slides-list">
          {searchSections.map((s, i) => (
            <div key={`${s.label}-${s.catalogKey}`} className="admin__slide-card">
              <div className="admin__slide-card-header">
                <span className="admin__slide-num">Раздел {i + 1}</span>
                <button
                  type="button"
                  className="admin__icon-btn admin__icon-btn--danger"
                  onClick={() => setSearchSections((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </button>
              </div>
              <div className="admin__two-col">
                <div className="admin__field">
                  <span className="admin__label">Название</span>
                  <input
                    className="admin__input"
                    value={s.label}
                    onChange={(e) => setSearchSections((prev) => prev.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                    placeholder="Мышки"
                  />
                </div>
                <div className="admin__field">
                  <span className="admin__label">Ключ категории</span>
                  <select
                    className="admin__select"
                    value={CATEGORY_KEYS.includes(s.catalogKey) ? s.catalogKey : '__none__'}
                    onChange={(e) => {
                      const v = e.target.value
                      setSearchSections((prev) => prev.map((x, idx) => idx === i ? { ...x, catalogKey: v === '__none__' ? '' : v } : x))
                    }}
                  >
                    <option value="__none__">— без фильтра (весь каталог) —</option>
                    {CATEGORY_KEYS.map((k) => (
                      <option key={k} value={k}>{CATEGORY_KEY_LABELS[k] ?? k}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="admin__spec-add-btn"
          style={{ marginTop: 4 }}
          onClick={() => setSearchSections((prev) => [...prev, { label: '', catalogKey: '' }])}
        >
          + Добавить раздел
        </button>
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
                  <span className="admin__label">Имя / Ник *</span>
                  <input className="admin__input" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="shadowkekw" required />
                </div>
                <div className="admin__field">
                  <span className="admin__label">Ссылка (соцсети / канал)</span>
                  <input className="admin__input" type="url" value={form.social_url} onChange={(e) => setField('social_url', e.target.value)} placeholder="https://t.me/..." />
                </div>
              </div>
              <div className="admin__field">
                <span className="admin__label">Описание</span>
                <textarea className="admin__textarea" rows={3} value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Краткое описание блогера..." />
              </div>
            </div>

            <div className="admin__form-section">
              <p className="admin__form-section-title">Фото</p>
              <div className="admin__field">
                <span className="admin__label">URL фото <span className="admin__label-hint">(фон карточки, рекомендуется 600×400 px)</span></span>
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
                  <span className="admin__label">Порядок сортировки</span>
                  <input className="admin__input" type="number" min="0" value={form.sort_order} onChange={(e) => setField('sort_order', e.target.value)} />
                </div>
                <div className="admin__field">
                  <span className="admin__label">Видимость</span>
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

// ── Orders tab ────────────────────────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [filter, setFilter] = useState<OrderStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const list = await listOrders(filter ? { status: filter } : {})
      setOrders(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [filter])

  async function setStatus(id: number, status: OrderStatus) {
    setBusyId(id)
    try {
      const updated = await updateOrderStatus(id, status)
      setOrders((prev) => prev.map((o) => o.id === id ? updated : o))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: number) {
    if (!confirm(`Удалить заказ #${id}?`)) return
    setBusyId(id)
    try {
      await deleteOrder(id)
      setOrders((prev) => prev.filter((o) => o.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'delete failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin__content-tab">
      <div className="admin__content-header">
        <h2 className="admin__content-title">Заказы</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {error && <span style={{ color: 'var(--color-main)', fontSize: 13 }}>{error}</span>}
          <select className="admin__input" value={filter} onChange={(e) => setFilter(e.target.value as OrderStatus | '')} style={{ width: 200 }}>
            <option value="">Все статусы</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
          </select>
          <button type="button" className="admin__save-btn" onClick={() => void load()} disabled={loading}>
            {loading ? 'Обновляем...' : 'Обновить'}
          </button>
        </div>
      </div>
      <p className="admin__label-hint" style={{ marginBottom: 16 }}>
        Заказы из формы корзины + изменения статусов из Telegram-бота приходят в эту таблицу. Редактирование статуса здесь сразу отправляется в БД, бот тоже её читает.
      </p>

      {orders.length === 0 ? (
        <div className="admin__content-empty">
          <p className="admin__empty-text">{loading ? 'Загрузка...' : 'Заказов нет'}</p>
        </div>
      ) : (
        <div className="admin__inbox-list">
          {orders.map((o) => (
            <div key={o.id} className="admin__inbox-card">
              <div className="admin__inbox-card-head">
                <div>
                  <span className="admin__inbox-id">#{o.id}</span>
                  <span className={`admin__inbox-status admin__inbox-status--${o.status}`}>
                    {ORDER_STATUS_LABELS[o.status]}
                  </span>
                </div>
                <span className="admin__inbox-date">{new Date(o.created_at).toLocaleString('ru-RU')}</span>
              </div>
              <div className="admin__inbox-meta">
                <div><b>Имя:</b> {o.customer_name || '—'}</div>
                <div><b>Контакт:</b> {o.customer_contact || '—'}</div>
                <div><b>Доставка:</b> {o.delivery || '—'}</div>
              </div>
              {o.comment && <p className="admin__inbox-text">{o.comment}</p>}
              <ul className="admin__inbox-items">
                {(o.items ?? []).map((it, i) => (
                  <li key={`${o.id}-${i}`}>
                    <span>{it.title}</span>
                    <span>{it.quantity} × {it.price.toLocaleString('ru-RU')} ₽</span>
                  </li>
                ))}
              </ul>
              <div className="admin__inbox-total">
                <span>Итого</span>
                <strong>{o.total.toLocaleString('ru-RU')} ₽</strong>
              </div>
              <div className="admin__inbox-actions">
                <div className="admin__inbox-statuses">
                  {ORDER_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`admin__inbox-status-btn ${o.status === s ? 'admin__inbox-status-btn--active' : ''}`}
                      onClick={() => void setStatus(o.id, s)}
                      disabled={busyId === o.id || o.status === s}
                    >
                      {ORDER_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                <button type="button" className="admin__inbox-delete" onClick={() => void remove(o.id)} disabled={busyId === o.id}>
                  удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: 'новый',
  in_progress: 'в работе',
  done: 'выполнен',
  cancelled: 'отменён',
}

// ── Inquiries tab ─────────────────────────────────────────────────────────────
const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: 'новая',
  in_progress: 'в работе',
  done: 'закрыта',
}
const INQUIRY_CATEGORY_LABELS: Record<InquiryCategory, string> = {
  order: 'заказ',
  product: 'товар',
  choose: 'помощь с выбором',
  delivery: 'доставка',
  other: 'другое',
}

function InquiriesTab() {
  const [items, setItems] = useState<AdminInquiry[]>([])
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | ''>('')
  const [categoryFilter, setCategoryFilter] = useState<InquiryCategory | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const list = await listInquiries({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      })
      setItems(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [statusFilter, categoryFilter])

  async function setStatus(id: number, status: InquiryStatus) {
    setBusyId(id)
    try {
      const updated = await updateInquiryStatus(id, status)
      setItems((prev) => prev.map((o) => o.id === id ? updated : o))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'update failed')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(id: number) {
    if (!confirm(`Удалить заявку #${id}?`)) return
    setBusyId(id)
    try {
      await deleteInquiry(id)
      setItems((prev) => prev.filter((o) => o.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'delete failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="admin__content-tab">
      <div className="admin__content-header">
        <h2 className="admin__content-title">Заявки в поддержку</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {error && <span style={{ color: 'var(--color-main)', fontSize: 13 }}>{error}</span>}
          <select className="admin__input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as InquiryCategory | '')} style={{ width: 180 }}>
            <option value="">Все категории</option>
            {INQUIRY_CATEGORIES.map((c) => <option key={c} value={c}>{INQUIRY_CATEGORY_LABELS[c]}</option>)}
          </select>
          <select className="admin__input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InquiryStatus | '')} style={{ width: 160 }}>
            <option value="">Все статусы</option>
            {INQUIRY_STATUSES.map((s) => <option key={s} value={s}>{INQUIRY_STATUS_LABELS[s]}</option>)}
          </select>
          <button type="button" className="admin__save-btn" onClick={() => void load()} disabled={loading}>
            {loading ? 'Обновляем...' : 'Обновить'}
          </button>
        </div>
      </div>
      <p className="admin__label-hint" style={{ marginBottom: 16 }}>
        Заявки из формы поддержки и со страниц «помощь с выбором». Telegram-бот пишет сюда же — обновления синхронны.
      </p>

      {items.length === 0 ? (
        <div className="admin__content-empty">
          <p className="admin__empty-text">{loading ? 'Загрузка...' : 'Заявок нет'}</p>
        </div>
      ) : (
        <div className="admin__inbox-list">
          {items.map((q) => (
            <div key={q.id} className="admin__inbox-card">
              <div className="admin__inbox-card-head">
                <div>
                  <span className="admin__inbox-id">#{q.id}</span>
                  <span className={`admin__inbox-status admin__inbox-status--${q.status}`}>
                    {INQUIRY_STATUS_LABELS[q.status]}
                  </span>
                  <span className="admin__inbox-tag">{INQUIRY_CATEGORY_LABELS[q.category]}</span>
                </div>
                <span className="admin__inbox-date">{new Date(q.created_at).toLocaleString('ru-RU')}</span>
              </div>
              <div className="admin__inbox-meta">
                <div><b>Имя:</b> {q.customer_name || '—'}</div>
                <div><b>Контакт:</b> {q.customer_contact || '—'}</div>
              </div>
              <p className="admin__inbox-text">{q.message}</p>
              <div className="admin__inbox-actions">
                <div className="admin__inbox-statuses">
                  {INQUIRY_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`admin__inbox-status-btn ${q.status === s ? 'admin__inbox-status-btn--active' : ''}`}
                      onClick={() => void setStatus(q.id, s)}
                      disabled={busyId === q.id || q.status === s}
                    >
                      {INQUIRY_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
                <button type="button" className="admin__inbox-delete" onClick={() => void remove(q.id)} disabled={busyId === q.id}>
                  удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pages tab (editable content for about/partnership/help-choose/delivery/modding/support) ─
type PageId = 'about' | 'partnership' | 'support' | 'help_choose' | 'delivery' | 'modding'

const PAGE_LABELS: Record<PageId, string> = {
  about: 'О нас',
  partnership: 'Партнёрство',
  support: 'Поддержка',
  help_choose: 'Помощь с выбором',
  delivery: 'Доставка и оплата',
  modding: 'Моддинг',
}

// Each page exposes a minimal set of overridable text fields. The page reads
// `page_<id>_<lang>.<field>` from site_content and falls back to the i18n value
// shipped in the app bundle when the field is empty/missing.
const PAGE_FIELDS: Record<PageId, Array<{ key: string; label: string; multiline?: boolean }>> = {
  about: [
    { key: 'eyebrow', label: 'Eyebrow (мелкая надпись)' },
    { key: 'title', label: 'Заголовок' },
    { key: 'subtitle', label: 'Подзаголовок', multiline: true },
    { key: 'storyTitle', label: 'Заголовок секции "story"' },
    { key: 'storyText', label: 'Текст секции "story"', multiline: true },
    { key: 'contactTitle', label: 'CTA: заголовок' },
    { key: 'contactText', label: 'CTA: текст', multiline: true },
  ],
  partnership: [
    { key: 'eyebrow', label: 'Eyebrow' },
    { key: 'title', label: 'Заголовок' },
    { key: 'subtitle', label: 'Подзаголовок', multiline: true },
    { key: 'ctaLabel', label: 'CTA: подпись' },
    { key: 'ctaText', label: 'CTA: текст', multiline: true },
  ],
  support: [
    { key: 'eyebrow', label: 'Eyebrow' },
    { key: 'title', label: 'Заголовок' },
    { key: 'subtitle', label: 'Подзаголовок', multiline: true },
    { key: 'statResponse', label: 'Stat: значение' },
    { key: 'statResponseLabel', label: 'Stat: подпись' },
  ],
  help_choose: [
    { key: 'eyebrow', label: 'Eyebrow' },
    { key: 'title', label: 'Заголовок' },
    { key: 'subtitle', label: 'Подзаголовок', multiline: true },
    { key: 'resultTitle', label: 'Результат: заголовок' },
    { key: 'resultText', label: 'Результат: текст', multiline: true },
  ],
  delivery: [
    { key: 'eyebrow', label: 'Eyebrow' },
    { key: 'title', label: 'Заголовок' },
    { key: 'subtitle', label: 'Подзаголовок', multiline: true },
    { key: 'statusChip', label: 'Статус-чип (рядом с hero)' },
    { key: 'timelineTitle', label: 'Заголовок таймлайна' },
    { key: 'paymentTitle', label: 'Заголовок секции оплаты' },
    { key: 'coverageTitle', label: 'Заголовок сроков по регионам' },
    { key: 'faqTitle', label: 'Заголовок FAQ' },
  ],
  modding: [
    { key: 'eyebrow', label: 'Eyebrow' },
    { key: 'titleStart', label: 'Заголовок (начало)' },
    { key: 'titleAccent', label: 'Заголовок (акцент)' },
    { key: 'titleEnd', label: 'Заголовок (конец)' },
    { key: 'subtitle', label: 'Подзаголовок', multiline: true },
    { key: 'processTitle', label: 'Заголовок "Процесс работы"' },
    { key: 'bundlesTitle', label: 'Заголовок секции комплектов' },
    { key: 'bundlesSubtitle', label: 'Подзаголовок секции комплектов' },
  ],
}

function PagesTab() {
  const [pageId, setPageId] = useState<PageId>('about')
  const [lang, setLang] = useState<'ru' | 'en'>('ru')
  const [data, setData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const storageKey = `page_${pageId}_${lang}`

  useEffect(() => {
    setLoading(true)
    setError('')
    setSaved(false)
    fetchSiteContent<Record<string, string>>(storageKey).then((result) => {
      setData(result.data ?? {})
      setLoading(false)
    })
  }, [storageKey])

  function setField(field: string, value: string) {
    setData((prev) => ({ ...prev, [field]: value }))
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      await updateSiteContent(storageKey, data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save failed')
    } finally {
      setSaving(false)
    }
  }

  const fields = PAGE_FIELDS[pageId]

  return (
    <div className="admin__content-tab">
      <div className="admin__content-header">
        <h2 className="admin__content-title">Контент страниц</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {saved && <span className="admin__saved-toast">Сохранено ✓</span>}
          {error && <span style={{ color: 'var(--color-main)', fontSize: 13 }}>{error}</span>}
          <button type="button" className="admin__save-btn" onClick={() => void save()} disabled={saving || loading}>
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </div>
      <p className="admin__label-hint" style={{ marginBottom: 16 }}>
        Перетекстовка заголовков и подписей на сервисных страницах. Пустое поле = текст из приложения по умолчанию.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="admin__field" style={{ flex: 1, minWidth: 220 }}>
          <span className="admin__label">Страница</span>
          <select className="admin__input" value={pageId} onChange={(e) => setPageId(e.target.value as PageId)}>
            {(Object.keys(PAGE_LABELS) as PageId[]).map((id) => (
              <option key={id} value={id}>{PAGE_LABELS[id]}</option>
            ))}
          </select>
        </div>
        <div>
          <span className="admin__label" style={{ display: 'block', marginBottom: 6 }}>Язык</span>
          <div className="admin__lang-tabs">
            {(['ru', 'en'] as const).map((lng) => (
              <button
                key={lng}
                type="button"
                className={`admin__lang-tab ${lang === lng ? 'admin__lang-tab--active' : ''}`.trim()}
                onClick={() => setLang(lng)}
              >
                {lng.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="admin__content-empty">
          <p className="admin__empty-text">Загрузка...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14 }}>
          {fields.map((f) => (
            <div key={f.key} className="admin__field">
              <span className="admin__label">{f.label}</span>
              {f.multiline ? (
                <textarea
                  className="admin__input"
                  rows={3}
                  value={data[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder="оставьте пустым для дефолтного текста"
                  style={{ resize: 'vertical', fontFamily: 'inherit' }}
                />
              ) : (
                <input
                  className="admin__input"
                  value={data[f.key] ?? ''}
                  onChange={(e) => setField(f.key, e.target.value)}
                  placeholder="оставьте пустым для дефолтного текста"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
