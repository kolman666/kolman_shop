// Modal that appears the moment a `?share-cart=...` URL gets imported into
// the receiver's cart. Shows what landed, with a slide-in animation. The
// modal listens for SHARE_CART_IMPORTED_EVENT dispatched by importCartFromUrl
// (called from main.tsx before React mounts) — when products finish
// hydrating we surface the modal with proper product names + thumbs.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SHARE_CART_IMPORTED_EVENT } from '../lib/cart'
import { useProducts } from '../hooks/useProducts'

type ImportPayload = { items: Record<string, number> } | null

export default function ShareCartImportToast() {
  const [payload, setPayload] = useState<ImportPayload>(null)
  const [closing, setClosing] = useState(false)
  const { products } = useProducts()

  useEffect(() => {
    // 1) Listen for new imports happening at runtime.
    const onImport = (e: Event) => {
      const detail = (e as CustomEvent<{ items: Record<string, number> }>).detail
      if (detail?.items) {
        setPayload({ items: detail.items })
        setClosing(false)
      }
    }
    window.addEventListener(SHARE_CART_IMPORTED_EVENT, onImport)
    // 2) Recover from the page-load case: main.tsx fires this event BEFORE
    //    React mounts, so the listener attached above misses it. We stash
    //    the payload on `window` from main.tsx and pick it up here on mount.
    type WithPending = typeof window & { __pendingShareCart?: { items: Record<string, number> } }
    const win = window as WithPending
    if (win.__pendingShareCart?.items) {
      setPayload({ items: win.__pendingShareCart.items })
      delete win.__pendingShareCart
    }
    return () => window.removeEventListener(SHARE_CART_IMPORTED_EVENT, onImport)
  }, [])

  // Resolve product details (image + title + price) once products hydrate.
  const lines = useMemo(() => {
    if (!payload) return []
    const byId = new Map(products.map((p) => [p.id, p]))
    return Object.entries(payload.items).map(([id, qty]) => {
      const p = byId.get(Number(id))
      return p
        ? { id: p.id, title: p.titleDirect ?? p.brand, image: p.image, price: p.price, qty, slug: p.slug }
        : { id: Number(id), title: `товар #${id}`, image: '', price: 0, qty, slug: '' }
    })
  }, [payload, products])

  // Auto-close after 10s.
  useEffect(() => {
    if (!payload) return
    const t = window.setTimeout(() => handleClose(), 10_000)
    return () => window.clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload])

  if (!payload) return null

  function handleClose() {
    setClosing(true)
    window.setTimeout(() => {
      setPayload(null)
      setClosing(false)
    }, 280)
  }

  const totalQty = lines.reduce((s, l) => s + l.qty, 0)
  const totalSum = lines.reduce((s, l) => s + (l.price * l.qty), 0)

  return (
    <div className={`share-cart-toast ${closing ? 'share-cart-toast--closing' : 'share-cart-toast--open'}`}>
      <button type="button" className="share-cart-toast__backdrop" onClick={handleClose} aria-label="закрыть" />
      <div className="share-cart-toast__panel" role="dialog" aria-modal="true">
        <button type="button" className="share-cart-toast__close" onClick={handleClose} aria-label="закрыть">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>

        <div className="share-cart-toast__header">
          <div className="share-cart-toast__icon" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 01-8 0" />
            </svg>
          </div>
          <div>
            <p className="share-cart-toast__title">с вами поделились корзиной</p>
            <p className="share-cart-toast__sub">
              {totalQty} {plural(totalQty, ['товар', 'товара', 'товаров'])} добавлено в вашу корзину
            </p>
          </div>
        </div>

        <ul className="share-cart-toast__list">
          {lines.map((l, i) => (
            <li
              key={l.id}
              className="share-cart-toast__line"
              style={{ animationDelay: `${0.06 * i + 0.15}s` }}
            >
              {l.image ? (
                <img src={l.image} alt="" loading="lazy" className="share-cart-toast__thumb" />
              ) : (
                <div className="share-cart-toast__thumb share-cart-toast__thumb--empty" />
              )}
              <div className="share-cart-toast__line-info">
                <span className="share-cart-toast__line-title">{l.title}</span>
                {l.price > 0 && (
                  <span className="share-cart-toast__line-meta">
                    {l.qty} × {l.price.toLocaleString('ru-RU')} ₽
                  </span>
                )}
              </div>
              {l.slug && (
                <Link to={`/product/${l.slug}`} className="share-cart-toast__line-link" onClick={handleClose}>
                  открыть
                </Link>
              )}
            </li>
          ))}
        </ul>

        {totalSum > 0 && (
          <div className="share-cart-toast__total">
            <span>итого</span>
            <strong>{totalSum.toLocaleString('ru-RU')} ₽</strong>
          </div>
        )}
        <div className="share-cart-toast__actions">
          <button
            type="button"
            className="cta-btn share-cart-toast__cta"
            onClick={() => {
              handleClose()
              window.dispatchEvent(new Event('cart:open'))
            }}
          >
            открыть корзину
          </button>
        </div>
      </div>
    </div>
  )
}

function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}
