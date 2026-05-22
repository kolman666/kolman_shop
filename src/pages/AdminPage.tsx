import { useState, useEffect, useRef } from 'react'
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
import { ContentTabV2 } from './admin/ContentTabV2'
import { BrandPagesTab } from './admin/BrandPagesTab'
import { PagesTabV2 } from './admin/PagesTabV2'
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
import {
  adminFetchThreadMessages,
  adminReply,
  adminListAllChatThreads,
  adminSetThreadStatus,
  adminLookupUsers,
  type ChatMessage,
  type ChatThread,
  type UserLookup,
} from '../lib/customerInbox'
import { supabase } from '../lib/supabase'
import { playChatNotificationSound, showBrowserChatNotification } from '../lib/chatNotifications'

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
  // Used marketplace (Барахолка) fields. `isUsed` flips the product into the
  // /used catalog; the other three describe the second-hand condition.
  isUsed: boolean
  condition: string
  defects: string
  originalPrice: string
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
  isUsed: false,
  condition: '',
  defects: '',
  originalPrice: '',
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
    isUsed: p.isUsed ?? false,
    condition: p.condition ?? '',
    defects: p.defects ?? '',
    originalPrice: p.originalPrice != null ? String(p.originalPrice) : '',
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
    is_used: form.isUsed,
    condition: form.condition,
    defects: form.defects,
    original_price: form.originalPrice.trim() ? (parseFloat(form.originalPrice) || 0) : undefined,
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

type AdminTab = 'products' | 'content' | 'pages' | 'brands' | 'orders' | 'inquiries' | 'chat' | 'bloggers'

// ── Admin panel inner ─────────────────────────────────────────────────────────
function AdminPanel({ onLogout }: { onLogout: () => void }) {
  const { products: allProducts, loading: productsLoading, refresh } = useProducts()
  const [activeTab, setActiveTab] = useState<AdminTab>('products')
  // Counts unique chats that received new customer messages while the admin
  // was outside the chat tab. Resets when the tab is opened.
  const [unreadChatThreadIds, setUnreadChatThreadIds] = useState<Set<number | string>>(() => new Set())
  const [chatToast, setChatToast] = useState<{ title: string; body: string } | null>(null)
  const unreadChat = unreadChatThreadIds.size

  useEffect(() => {
    const sb = supabase
    if (!sb) return
    const channel = sb
      .channel('admin-chat-tab-badge')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload?.new as { sender?: string; body?: string; thread_email?: string; thread_id?: number | null; id?: number } | null
          if (row?.sender !== 'user') return
          const threadKey = row.thread_id ?? row.thread_email ?? row.id ?? Date.now()
          if (activeTab !== 'chat') {
            setUnreadChatThreadIds((prev) => {
              const next = new Set(prev)
              next.add(threadKey)
              return next
            })
          }
          const nextToast = {
            title: 'Новое сообщение в чате',
            body: `${row.thread_email ?? 'клиент'}: ${(row.body ?? '').slice(0, 120)}`,
          }
          setChatToast(nextToast)
          playChatNotificationSound()
          showBrowserChatNotification(nextToast.title, nextToast.body, `admin-chat-${threadKey}`)
          window.setTimeout(() => {
            setChatToast((current) => (current?.body === nextToast.body ? null : current))
          }, 4200)
        },
      )
      .subscribe()
    return () => { void sb.removeChannel(channel) }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'chat') {
      setUnreadChatThreadIds(new Set())
      setChatToast(null)
    }
  }, [activeTab])

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
        <button type="button" className={`admin__tab-btn${activeTab === 'brands' ? ' active' : ''}`} onClick={() => setActiveTab('brands')}>
          Бренды
        </button>
        <button type="button" className={`admin__tab-btn${activeTab === 'orders' ? ' active' : ''}`} onClick={() => setActiveTab('orders')}>
          Заказы
        </button>
        <button type="button" className={`admin__tab-btn${activeTab === 'inquiries' ? ' active' : ''}`} onClick={() => setActiveTab('inquiries')}>
          Заявки
        </button>
        <button type="button" className={`admin__tab-btn${activeTab === 'chat' ? ' active' : ''}`} onClick={() => setActiveTab('chat')}>
          Чат
          {unreadChat > 0 && <span className="admin__tab-badge">{unreadChat}</span>}
        </button>
        <button type="button" className={`admin__tab-btn${activeTab === 'bloggers' ? ' active' : ''}`} onClick={() => setActiveTab('bloggers')}>
          Блогеры
        </button>
      </div>

      <div className={`chat-site-toast chat-site-toast--admin ${chatToast ? 'chat-site-toast--visible' : ''}`}>
        <strong>{chatToast?.title}</strong>
        <span>{chatToast?.body}</span>
      </div>

      {activeTab === 'content' && <ContentTabV2 />}
      {activeTab === 'pages' && <PagesTabV2 />}
      {activeTab === 'brands' && <BrandPagesTab />}
      {activeTab === 'orders' && <OrdersTab />}
      {activeTab === 'inquiries' && <InquiriesTab />}
      {activeTab === 'chat' && <ChatTab />}
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

              {/* ── Used marketplace (Барахолка) ─────────────────────
                  Flip the product into the second-hand catalog. When
                  enabled, the new fields below become the source of
                  truth for the /used page.
              */}
              <div className="admin__form-section">
                <h3 className="admin__section-title">Барахолка</h3>
                <div className="admin__field">
                  <label className="admin__checkbox-field">
                    <input
                      type="checkbox"
                      className="admin__checkbox-input"
                      checked={form.isUsed}
                      onChange={(e) => setField('isUsed', e.target.checked)}
                    />
                    <span className="admin__checkbox-label">
                      Это б/у девайс (показывать на /used вместо /catalog)
                    </span>
                  </label>
                </div>

                {form.isUsed && (
                  <>
                    <div className="admin__two-col">
                      <div className="admin__field">
                        <span className="admin__label">Состояние</span>
                        <select
                          className="admin__input"
                          value={form.condition}
                          onChange={(e) => setField('condition', e.target.value)}
                        >
                          <option value="">— не указано —</option>
                          <option value="like_new">как новый</option>
                          <option value="good">хорошее</option>
                          <option value="used">б/у</option>
                          <option value="poor">есть нюансы</option>
                        </select>
                      </div>
                      <div className="admin__field">
                        <span className="admin__label">
                          Первоначальная цена{' '}
                          <span className="admin__label-hint">для расчёта скидки</span>
                        </span>
                        <input
                          className="admin__input"
                          type="number"
                          min="0"
                          step="100"
                          placeholder="9990"
                          value={form.originalPrice}
                          onChange={(e) => setField('originalPrice', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="admin__field">
                      <span className="admin__label">
                        Недостатки / нюансы{' '}
                        <span className="admin__label-hint">видно покупателю в карточке</span>
                      </span>
                      <textarea
                        className="admin__input"
                        rows={3}
                        value={form.defects}
                        onChange={(e) => setField('defects', e.target.value)}
                        placeholder="небольшой скол на корпусе, протёртые накладки..."
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                      />
                    </div>
                  </>
                )}
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
  customer_email TEXT NOT NULL DEFAULT '',
  delivery TEXT NOT NULL DEFAULT '',
  comment TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_email_idx ON orders(customer_email, created_at DESC);
CREATE TABLE IF NOT EXISTS inquiries (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'new',
  customer_name TEXT NOT NULL DEFAULT '',
  customer_contact TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS customer_email TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS inquiries_category_idx ON inquiries(category, created_at DESC);
CREATE INDEX IF NOT EXISTS inquiries_email_idx ON inquiries(customer_email, created_at DESC);
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  thread_email TEXT NOT NULL,
  sender TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS messages_thread_idx ON messages(thread_email, created_at);

-- Multi-thread chat: customers can have several ongoing conversations and
-- close them when resolved. Each chat_threads row groups its messages by
-- thread_id; older messages without a thread are migrated below.
CREATE TABLE IF NOT EXISTS chat_threads (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_threads_user_idx ON chat_threads (user_email, last_message_at DESC);
CREATE INDEX IF NOT EXISTS chat_threads_status_idx ON chat_threads (status, last_message_at DESC);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS thread_id BIGINT REFERENCES chat_threads(id) ON DELETE CASCADE;

-- One-time migration: any pre-existing message without thread_id gets bucketed
-- into a single thread per email so nothing disappears.
DO $$
DECLARE
  rec RECORD;
  new_id BIGINT;
BEGIN
  FOR rec IN
    SELECT thread_email, MIN(created_at) AS first_at, MAX(created_at) AS last_at
    FROM messages
    WHERE thread_id IS NULL
    GROUP BY thread_email
  LOOP
    INSERT INTO chat_threads (user_email, title, created_at, last_message_at)
    VALUES (rec.thread_email, 'Архив', rec.first_at, rec.last_at)
    RETURNING id INTO new_id;
    UPDATE messages SET thread_id = new_id WHERE thread_email = rec.thread_email AND thread_id IS NULL;
  END LOOP;
END $$;

-- Enable Realtime for chat. After running this, also flip the toggle for the
-- "messages" table in Supabase Studio → Database → Replication if it doesn't
-- show up automatically.
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_threads;

-- Customer accounts (replaces the old localStorage-only auth). PBKDF2-SHA256
-- password hashes are computed server-side; the client only ever holds a
-- short-lived bearer token.
CREATE TABLE IF NOT EXISTS auth_users (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 150000,
  name TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  photo TEXT NOT NULL DEFAULT '',
  telegram TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_idx ON auth_users (LOWER(email));

-- Product reviews. Stored server-side so the same review shows up on every
-- device the customer is logged into, and so other shoppers see it.
CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL,
  author_email TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT NOT NULL DEFAULT '',
  photos JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_author_idx ON reviews (author_email, created_at DESC);

-- Used marketplace (Барахолка) — extend admin_products with second-hand fields.
ALTER TABLE admin_products ADD COLUMN IF NOT EXISTS is_used BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE admin_products ADD COLUMN IF NOT EXISTS condition TEXT NOT NULL DEFAULT '';
ALTER TABLE admin_products ADD COLUMN IF NOT EXISTS defects TEXT NOT NULL DEFAULT '';
ALTER TABLE admin_products ADD COLUMN IF NOT EXISTS original_price NUMERIC;
CREATE INDEX IF NOT EXISTS admin_products_used_idx ON admin_products (is_used) WHERE is_used = TRUE;`

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


// ── Chat tab ──────────────────────────────────────────────────────────────────
// Lists customer chat threads (one per email) on the left, opens a conversation
// pane on the right. Admin replies are stored with sender='admin'; the customer
// sees them in their /profile → чат tab. Both sides poll the API every 8s.

function ChatTab() {
  const [threads, setThreads] = useState<ChatThread[]>([])
  // Map email → profile snapshot so we can label threads with the customer's
  // real name (and telegram) instead of just the email address.
  const [userLookup, setUserLookup] = useState<Record<string, UserLookup>>({})
  const [active, setActive] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loadingThreads, setLoadingThreads] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('open')
  const listRef = useRef<HTMLDivElement>(null)

  async function loadThreads(silent = false) {
    if (!silent) setLoadingThreads(true)
    setError('')
    try {
      const rows = await adminListAllChatThreads()
      setThreads(rows)
      // Pre-fetch user names for every email in the list so the sidebar
      // renders display names instantly.
      const uniqueEmails = Array.from(new Set(rows.map((r) => r.user_email)))
      if (uniqueEmails.length > 0) {
        const lookup = await adminLookupUsers(uniqueEmails)
        setUserLookup((prev) => ({ ...prev, ...lookup }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      if (!silent) setLoadingThreads(false)
    }
  }

  // Pick the best display label for a customer email: full name if available,
  // otherwise first part of the email. Telegram is shown alongside when set.
  function displayNameFor(email: string): string {
    const u = userLookup[email]
    if (!u) return email.split('@')[0]
    const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim()
    return full || u.name || email.split('@')[0]
  }

  async function loadMessages(threadId: number) {
    setLoadingMessages(true)
    try {
      const rows = await adminFetchThreadMessages(threadId)
      setMessages(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => { void loadThreads() }, [])

  // Global realtime listener — keeps the threads list fresh and pings the
  // admin with a desktop notification when a customer writes in.
  useEffect(() => {
    const sb = supabase
    if (!sb) return
    if ('Notification' in window && Notification.permission === 'default') {
      try { void Notification.requestPermission() } catch { /* ignore */ }
    }
    const msgChannel = sb
      .channel('admin-chat-threads-global')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const row = payload?.new as { sender?: string; thread_email?: string; body?: string; thread_id?: number } | null
          if (!row) return
          void loadThreads(true)
          if (row.sender !== 'user') return
          if (active && row.thread_id === active) return
          playChatNotificationSound()
          try {
            if ('Notification' in window && Notification.permission === 'granted') {
              const n = new Notification('Новое сообщение в чате', {
                body: `${row.thread_email ?? ''}: ${(row.body ?? '').slice(0, 140)}`,
                tag: `chat-${row.thread_id}`,
              })
              n.onclick = () => {
                window.focus()
                if (row.thread_id) setActive(row.thread_id)
              }
            }
          } catch { /* ignore */ }
        },
      )
      .subscribe()
    const threadChannel = sb
      .channel('admin-chat-threads-rows')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_threads' },
        () => { void loadThreads(true) },
      )
      .subscribe()
    const poll = window.setInterval(() => { void loadThreads(true) }, 4_000)
    return () => {
      void sb.removeChannel(msgChannel)
      void sb.removeChannel(threadChannel)
      window.clearInterval(poll)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    if (!active) return
    void loadMessages(active)
    const sb = supabase
    if (sb) {
      const channel = sb
        .channel(`admin-chat-${active}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${active}` },
          () => { void loadMessages(active) },
        )
        .subscribe()
      const poll = window.setInterval(() => { void loadMessages(active) }, 3_000)
      return () => {
        void sb.removeChannel(channel)
        window.clearInterval(poll)
      }
    }
    const t = window.setInterval(() => { void loadMessages(active) }, 3_000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages.length])

  const activeThread = threads.find((th) => th.id === active) ?? null

  async function sendMessage() {
    if (!activeThread) return
    const text = draft.trim()
    if (!text) return
    setSending(true)
    setError('')
    try {
      const sent = await adminReply(activeThread.user_email, text, activeThread.id)
      setMessages((prev) => [...prev, sent])
      setDraft('')
      void loadThreads(true)
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'failed'
      if (/table_not_found|schema cache|public\.messages/.test(raw)) {
        setError('Таблица messages не создана. Откройте «Заявки» в админке, скопируйте SQL и запустите в Supabase.')
      } else if (/thread_closed/.test(raw)) {
        setError('Чат уже закрыт. Откройте его снова, чтобы ответить.')
        void loadThreads(true)
      } else {
        setError(raw)
      }
    } finally {
      setSending(false)
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    await sendMessage()
  }

  const handleDraftKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  async function toggleStatus(thread: ChatThread) {
    try {
      const updated = await adminSetThreadStatus(thread.id, thread.status === 'open' ? 'closed' : 'open')
      setThreads((prev) => prev.map((th) => (th.id === thread.id ? updated : th)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    }
  }

  const filteredThreads = threads.filter((th) => {
    if (statusFilter !== 'all' && th.status !== statusFilter) return false
    if (filter.trim()) {
      const q = filter.toLowerCase()
      return th.user_email.toLowerCase().includes(q) || th.title.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="admin__content-tab">
      <div className="admin__chat">
        <aside className="admin__chat-list">
          <div className="admin__chat-list-head">
            <h2 className="admin__content-title" style={{ margin: 0 }}>Чаты</h2>
            <button type="button" className="accordion__btn" onClick={() => void loadThreads()} disabled={loadingThreads}>
              {loadingThreads ? '...' : 'Обновить'}
            </button>
          </div>
          <div className="admin__chat-filters">
            {(['open', 'closed', 'all'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`admin__chat-filter ${statusFilter === s ? 'admin__chat-filter--active' : ''}`.trim()}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'open' ? 'открытые' : s === 'closed' ? 'закрытые' : 'все'}
              </button>
            ))}
          </div>
          <input
            className="admin__input"
            placeholder="поиск по email или теме"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filteredThreads.length === 0 ? (
            <p className="admin__empty-text" style={{ padding: 12 }}>{loadingThreads ? 'Загрузка...' : 'Чатов пока нет'}</p>
          ) : (
            <ul className="admin__chat-threads">
              {filteredThreads.map((th) => (
                <li key={th.id}>
                  <button
                    type="button"
                    className={`admin__chat-thread ${active === th.id ? 'admin__chat-thread--active' : ''} admin__chat-thread--${th.status}`.trim()}
                    onClick={() => setActive(th.id)}
                  >
                    <span className="admin__chat-thread-email">
                      <strong>{displayNameFor(th.user_email)}</strong>
                      <span className="admin__chat-thread-emailsub">{th.user_email}</span>
                    </span>
                    <span className="admin__chat-thread-title">{th.title || 'новый чат'}</span>
                    <span className="admin__chat-thread-meta">
                      <span className={`profile-chat-thread__status profile-chat-thread__status--${th.status}`}>
                        {th.status === 'open' ? 'открыт' : 'закрыт'}
                      </span>
                      <span className="admin__chat-thread-time">{new Date(th.last_message_at).toLocaleString('ru-RU')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="admin__chat-conversation">
          {!activeThread ? (
            <div className="admin__content-empty" style={{ padding: 60 }}>
              <p className="admin__empty-text">Выберите чат слева, чтобы открыть переписку</p>
            </div>
          ) : (
            <>
              <header className="admin__chat-head">
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, color: 'var(--color-text)' }}>
                    {activeThread.title || 'новый чат'} · {displayNameFor(activeThread.user_email)}
                    <span style={{ display: 'block', color: 'var(--color-text-dim)', fontSize: 12, fontWeight: 400, marginTop: 2 }}>
                      {activeThread.user_email}
                      {userLookup[activeThread.user_email]?.telegram && (
                        <> · {userLookup[activeThread.user_email].telegram}</>
                      )}
                    </span>
                  </h3>
                  <p className="admin__label-hint" style={{ margin: '4px 0 0' }}>
                    клиент видит этот чат в Личном кабинете → «Чат с поддержкой»
                  </p>
                </div>
                <button type="button" className="accordion__btn" onClick={() => void toggleStatus(activeThread)}>
                  {activeThread.status === 'open' ? 'Закрыть чат' : 'Открыть снова'}
                </button>
              </header>
              <div ref={listRef} className="admin__chat-messages admin-chat-flipped">
                {loadingMessages && messages.length === 0 ? (
                  <p className="profile-chat__empty">Загрузка...</p>
                ) : messages.length === 0 ? (
                  <p className="profile-chat__empty">Это новая переписка — напишите клиенту первым.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`profile-chat__msg profile-chat__msg--${m.sender}`}>
                      <div className="profile-chat__bubble">
                        <span className="profile-chat__sender">{m.sender === 'admin' ? 'вы (поддержка)' : displayNameFor(activeThread.user_email)}</span>
                        <p>{m.body}</p>
                        <time>{new Date(m.created_at).toLocaleString('ru-RU')}</time>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {activeThread.status === 'open' ? (
                <form className="admin__chat-form" onSubmit={(e) => { void send(e) }}>
                  <textarea
                    className="admin__input"
                    rows={2}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleDraftKeyDown}
                    placeholder="ваш ответ клиенту..."
                    style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    disabled={sending}
                  />
                  <button type="submit" className="admin__save-btn" disabled={sending || !draft.trim()}>
                    {sending ? 'Отправляем...' : 'Отправить'}
                  </button>
                </form>
              ) : (
                <p className="profile-chat__closed-note">Чат закрыт. Откройте его снова, чтобы ответить.</p>
              )}
              {error && <p style={{ color: 'var(--color-main)', fontSize: 13 }}>{error}</p>}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
