import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CART_SHARE_IMPORTED_EVENT, importCartFromUrl } from '../lib/cart'

/** Re-import shared cart on every navigation (SPA) + show a short toast. */
export default function CartShareListener() {
  const location = useLocation()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const result = importCartFromUrl()
    if (!result.imported) return
    window.dispatchEvent(new Event('cart:update'))
    window.dispatchEvent(new Event(CART_SHARE_IMPORTED_EVENT))
    const label = result.count === 1
      ? '1 позиция добавлена в корзину'
      : `${result.count} позиций добавлено в корзину`
    setToast(label)
    const t = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(t)
  }, [location.search])

  if (!toast) return null

  return (
    <div className="cart-share-toast" role="status">
      <span>{toast}</span>
      <button type="button" className="cart-share-toast__close" onClick={() => setToast(null)} aria-label="закрыть">
        ×
      </button>
    </div>
  )
}
