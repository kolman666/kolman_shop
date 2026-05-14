import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useProducts } from '../hooks/useProducts'
import { getCart, updateQuantity, removeFromCart, clearCart } from '../lib/cart'
import { sendTelegramMessage, TelegramSendError } from '../lib/telegram'

type CartDrawerProps = {
  isOpen: boolean
  onClose: () => void
}

type View = 'cart' | 'checkout' | 'success'

type CartEntry = {
  id: number
  title: string
  price: number
  image: string
  quantity: number
}

const DELIVERY_OPTIONS = [
  'СДЭК до двери',
  'СДЭК до пункта выдачи',
  'Почта России',
  'Самовывоз (Вологда)',
]

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sanitizeLine(s: string, maxLen = 200): string {
  return escapeHtml(s.replace(/[\r\n\t]/g, ' ').trim().slice(0, maxLen))
}

function buildOrderMessage(
  entries: CartEntry[],
  total: number,
  name: string,
  contact: string,
  delivery: string,
  comment: string,
): string {
  const lines: string[] = [
    '🛒 <b>новый заказ</b>',
    '',
    '📦 <b>состав:</b>',
  ]

  for (const entry of entries) {
    const itemTotal = entry.price * entry.quantity
    lines.push(`• ${escapeHtml(entry.title)} × ${entry.quantity} — ${itemTotal.toLocaleString('ru-RU')} ₽`)
  }

  lines.push('')
  lines.push(`💰 <b>итого:</b> ${total.toLocaleString('ru-RU')} ₽`)
  lines.push('')
  lines.push(`👤 <b>имя:</b> ${sanitizeLine(name) || '—'}`)
  lines.push(`📞 <b>контакт:</b> ${sanitizeLine(contact) || '—'}`)
  lines.push(`🚚 <b>доставка:</b> ${escapeHtml(delivery)}`)
  lines.push(`💬 <b>комментарий:</b> ${sanitizeLine(comment, 500) || '—'}`)

  return lines.join('\n')
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { t } = useTranslation()
  const { products } = useProducts()
  const [view, setView] = useState<View>('cart')
  const [cartEntries, setCartEntries] = useState<CartEntry[]>([])

  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [delivery, setDelivery] = useState(DELIVERY_OPTIONS[0] ?? '')
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const prevOpenRef = useRef(isOpen)

  const syncCart = useCallback(() => {
    const record = getCart()
    const entries: CartEntry[] = []
    for (const [idStr, qty] of Object.entries(record)) {
      const id = Number(idStr)
      const product = products.find((p) => p.id === id)
      if (product && qty > 0) {
        entries.push({
          id: product.id,
          title: product.titleDirect ?? t(product.titleKey),
          price: product.price,
          image: product.image,
          quantity: qty,
        })
      }
    }
    setCartEntries(entries)
  }, [products, t])

  useEffect(() => {
    syncCart()
    window.addEventListener('cart:update', syncCart)
    window.addEventListener('storage', syncCart)
    return () => {
      window.removeEventListener('cart:update', syncCart)
      window.removeEventListener('storage', syncCart)
    }
  }, [syncCart])

  // Reset view to 'cart' when drawer closes (but not after success)
  useEffect(() => {
    if (prevOpenRef.current && !isOpen && view !== 'success') {
      setView('cart')
    }
    prevOpenRef.current = isOpen
  }, [isOpen, view])

  // Block body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const total = cartEntries.reduce((acc, e) => acc + e.price * e.quantity, 0)

  function handleQtyChange(id: number, delta: number, currentQty: number) {
    const next = currentQty + delta
    if (next <= 0) {
      removeFromCart(id)
    } else {
      updateQuantity(id, next)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (cartEntries.length === 0) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const msg = buildOrderMessage(cartEntries, total, name, contact, delivery, comment)
      // Try the new orders endpoint first (stores in DB + sends to Telegram).
      // Fall back to plain telegram if the orders endpoint isn't deployed yet.
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cartEntries.map((e) => ({ id: e.id, title: e.title, price: e.price, quantity: e.quantity })),
            total,
            name,
            contact,
            delivery,
            comment,
            telegram_text: msg,
          }),
        })
        if (!res.ok) {
          // Endpoint missing OR DB table not migrated yet — still send to Telegram so order isn't lost
          if (res.status === 404 || res.status === 405) {
            await sendTelegramMessage(msg)
          } else {
            const body = await res.json().catch(() => ({}))
            const errMsg = (body as { error?: string }).error ?? 'request failed'
            const detail = (body as { error?: string; detail?: string }).detail
            if (res.status === 503 && errMsg === 'table_not_found') {
              await sendTelegramMessage(msg)
            } else {
              throw new TelegramSendError(res.status, errMsg, detail)
            }
          }
        }
      } catch (err) {
        if (err instanceof TelegramSendError) throw err
        // network/CORS — try fallback
        await sendTelegramMessage(msg)
      }
      clearCart()
      setView('success')
      setName('')
      setContact('')
      setDelivery(DELIVERY_OPTIONS[0] ?? '')
      setComment('')
    } catch (err) {
      const base = 'не удалось отправить заказ.'
      if (err instanceof TelegramSendError) {
        const tail = err.detail ? ` (${err.detail})` : err.message ? ` (${err.message})` : ''
        setSubmitError(`${base}${tail} проверьте подключение и попробуйте снова.`)
      } else {
        setSubmitError(`${base} проверьте подключение и попробуйте снова.`)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleClose() {
    if (view !== 'success') {
      setView('cart')
    }
    onClose()
  }

  const drawerStyle: CSSProperties = {
    position: 'fixed',
    right: 0,
    top: 0,
    bottom: 0,
    width: 420,
    maxWidth: '100vw',
    background: 'var(--color-bg-elevated)',
    borderLeft: '1px solid var(--color-border)',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 0.3s ease',
  }

  return (
    <>
      {isOpen && (
        <div
          className="cart-drawer-overlay"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      <div
        className="cart-drawer"
        style={drawerStyle}
        role="dialog"
        aria-modal="true"
        aria-label="корзина"
      >
        {view === 'cart' && (
          <CartView
            entries={cartEntries}
            total={total}
            onClose={handleClose}
            onQtyChange={handleQtyChange}
            onRemove={removeFromCart}
            onCheckout={() => setView('checkout')}
          />
        )}

        {view === 'checkout' && (
          <CheckoutView
            name={name}
            contact={contact}
            delivery={delivery}
            comment={comment}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onNameChange={setName}
            onContactChange={setContact}
            onDeliveryChange={setDelivery}
            onCommentChange={setComment}
            onBack={() => setView('cart')}
            onSubmit={(e) => { void handleSubmit(e) }}
          />
        )}

        {view === 'success' && (
          <SuccessView onClose={handleClose} />
        )}
      </div>
    </>
  )
}

// ─── Cart view ────────────────────────────────────────────────────────────────

type CartViewProps = {
  entries: CartEntry[]
  total: number
  onClose: () => void
  onQtyChange: (id: number, delta: number, currentQty: number) => void
  onRemove: (id: number) => void
  onCheckout: () => void
}

function CartView({ entries, total, onClose, onQtyChange, onRemove, onCheckout }: CartViewProps) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>корзина</span>
        <button
          type="button"
          className="icon-button"
          aria-label="закрыть корзину"
          onClick={onClose}
          style={{ color: 'var(--color-text-dim)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
        {entries.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              height: '100%',
              textAlign: 'center',
              paddingTop: 60,
              paddingBottom: 60,
            }}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              style={{ color: 'var(--color-text-ghost)', marginBottom: 8 }}
            >
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
            <p style={{ margin: 0, color: 'var(--color-text-dim)', fontSize: 15 }}>корзина пуста</p>
            <Link to="/catalog" className="ghost-btn" onClick={onClose}>
              в каталог
            </Link>
          </div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {entries.map((entry) => (
              <li key={entry.id} className="cart-item">
                <img
                  src={entry.image}
                  alt={entry.title}
                  className="cart-item__img"
                />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--color-text-soft)',
                    }}
                  >
                    {entry.title}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
                    {(entry.price * entry.quantity).toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="cart-item__qty">
                  <button
                    type="button"
                    className="cart-qty-btn"
                    aria-label="уменьшить количество"
                    onClick={() => onQtyChange(entry.id, -1, entry.quantity)}
                  >
                    −
                  </button>
                  <span style={{ minWidth: 20, textAlign: 'center', fontSize: 14, fontWeight: 600 }}>
                    {entry.quantity}
                  </span>
                  <button
                    type="button"
                    className="cart-qty-btn"
                    aria-label="увеличить количество"
                    onClick={() => onQtyChange(entry.id, 1, entry.quantity)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="cart-qty-btn cart-qty-btn--remove"
                    aria-label="удалить товар"
                    onClick={() => onRemove(entry.id)}
                    style={{ marginLeft: 4, color: 'var(--color-text-ghost)' }}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {entries.length > 0 && (
        <div
          style={{
            padding: '20px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-dim)', fontSize: 14 }}>итого</span>
            <span style={{ fontWeight: 700, fontSize: 20 }}>{total.toLocaleString('ru-RU')} ₽</span>
          </div>
          <button type="button" className="cta-btn" onClick={onCheckout} style={{ width: '100%', justifyContent: 'center' }}>
            оформить заказ
          </button>
        </div>
      )}
    </>
  )
}

// ─── Checkout view ────────────────────────────────────────────────────────────

type CheckoutViewProps = {
  name: string
  contact: string
  delivery: string
  comment: string
  isSubmitting: boolean
  submitError: string | null
  onNameChange: (v: string) => void
  onContactChange: (v: string) => void
  onDeliveryChange: (v: string) => void
  onCommentChange: (v: string) => void
  onBack: () => void
  onSubmit: (e: FormEvent) => void
}

function CheckoutView({
  name,
  contact,
  delivery,
  comment,
  isSubmitting,
  submitError,
  onNameChange,
  onContactChange,
  onDeliveryChange,
  onCommentChange,
  onBack,
  onSubmit,
}: CheckoutViewProps) {
  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="ghost-btn"
          onClick={onBack}
          style={{ padding: '6px 12px', fontSize: 13 }}
        >
          ← назад
        </button>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.01em' }}>оформление заказа</span>
      </div>

      <form
        onSubmit={onSubmit}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'grid', gap: 6 }}>
          <label className="catalog-field__label" htmlFor="cart-name">
            имя
          </label>
          <input
            id="cart-name"
            className="catalog-search__input"
            placeholder="как к вам обращаться"
            required
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label className="catalog-field__label" htmlFor="cart-contact">
            контакт (telegram / телефон / email)
          </label>
          <input
            id="cart-contact"
            className="catalog-search__input"
            placeholder="@username, +7... или email"
            required
            value={contact}
            onChange={(e) => onContactChange(e.target.value)}
          />
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label className="catalog-field__label" htmlFor="cart-delivery">
            способ доставки
          </label>
          <select
            id="cart-delivery"
            className="catalog-field__control"
            value={delivery}
            onChange={(e) => onDeliveryChange(e.target.value)}
          >
            {DELIVERY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gap: 6 }}>
          <label className="catalog-field__label" htmlFor="cart-comment">
            комментарий (необязательно)
          </label>
          <textarea
            id="cart-comment"
            className="catalog-search__input"
            placeholder="адрес, пожелания, вопросы..."
            rows={4}
            value={comment}
            onChange={(e) => onCommentChange(e.target.value)}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        {submitError && (
          <p
            style={{
              margin: 0,
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(225, 29, 29, 0.1)',
              border: '1px solid rgba(225, 29, 29, 0.25)',
              color: 'var(--color-main-hover)',
              fontSize: 13,
            }}
          >
            {submitError}
          </p>
        )}

        <button
          type="submit"
          className="product-page__cta"
          disabled={isSubmitting}
          style={{
            marginTop: 'auto',
            opacity: isSubmitting ? 0.55 : 1,
            cursor: isSubmitting ? 'wait' : 'pointer',
          }}
        >
          {isSubmitting ? 'отправка...' : 'подтвердить заказ'}
        </button>
      </form>
    </>
  )
}

// ─── Success view ─────────────────────────────────────────────────────────────

function SuccessView({ onClose }: { onClose: () => void }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: '40px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'rgba(225, 29, 29, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-main)',
          marginBottom: 8,
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
        заказ принят!
      </h2>

      <p style={{ margin: 0, color: 'var(--color-text-dim)', fontSize: 14, lineHeight: 1.7, maxWidth: '28ch' }}>
        свяжемся с вами в ближайшее время для подтверждения
      </p>

      <button type="button" className="cta-btn" onClick={onClose} style={{ marginTop: 8 }}>
        закрыть
      </button>
    </div>
  )
}
