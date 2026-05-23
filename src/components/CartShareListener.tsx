import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import { CART_SHARE_IMPORTED_EVENT, importCartFromUrl } from '../lib/cart'

export default function CartShareListener() {
  const location = useLocation()
  const { t } = useTranslation()
  const { products } = useProducts()
  const [importedItems, setImportedItems] = useState<Record<string, number> | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const handleShareImported = (event: Event) => {
      const detail = (event as CustomEvent<{ items: Record<string, number> }>)?.detail
      const items = detail?.items
      if (!items || Object.keys(items).length === 0) return

      setImportedItems(items)
      setIsModalOpen(true)
      const quantity = Object.values(items).reduce((sum, qty) => sum + qty, 0)
      const label = quantity === 1 ? '1 позиция добавлена в корзину' : `${quantity} позиций добавлено в корзину`
      setToast(label)
    }

    window.addEventListener(CART_SHARE_IMPORTED_EVENT, handleShareImported as EventListener)
    return () => {
      window.removeEventListener(CART_SHARE_IMPORTED_EVENT, handleShareImported as EventListener)
    }
  }, [])

  useEffect(() => {
    importCartFromUrl()
  }, [location.search])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    if (!isModalOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsModalOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen])

  const items = useMemo(() => {
    if (!importedItems) return []
    return Object.entries(importedItems).map(([id, qty]) => {
      const product = products.find((item) => item.id === Number(id))
      return { id: Number(id), qty, product }
    })
  }, [importedItems, products])

  const totalQuantity = items.reduce((sum, item) => sum + item.qty, 0)

  if (!toast && !isModalOpen) return null

  return (
    <>
      {toast && (
        <div className="cart-share-toast" role="status">
          <span>{toast}</span>
          <button type="button" className="cart-share-toast__close" onClick={() => setToast(null)} aria-label="закрыть">
            ×
          </button>
        </div>
      )}

      {isModalOpen && (
        <div className="cart-share-modal" role="dialog" aria-modal="true" aria-label="Вам поделились корзиной">
          <div className="cart-share-modal__overlay" onClick={() => setIsModalOpen(false)} />
          <div className="cart-share-modal__card">
            <button type="button" className="cart-share-modal__close" onClick={() => setIsModalOpen(false)} aria-label="закрыть">
              ×
            </button>
            <div className="cart-share-modal__head">
              <span className="cart-share-modal__label">Новая корзина</span>
              <h2 className="cart-share-modal__title">Вам поделились корзиной</h2>
              <p className="cart-share-modal__text">
                В вашу корзину добавлено {totalQuantity} {totalQuantity === 1 ? 'товар' : 'товара'}.
              </p>
            </div>

            <ul className="cart-share-modal__list">
              {items.map((item) => (
                <li key={item.id} className="cart-share-modal__item">
                  {item.product?.image ? (
                    <img src={item.product.image} alt="" className="cart-share-modal__thumb" />
                  ) : (
                    <div className="cart-share-modal__thumb cart-share-modal__thumb--fallback" />
                  )}
                  <div className="cart-share-modal__item-info">
                    <strong className="cart-share-modal__item-title">
                      {item.product ? (item.product.titleDirect ?? t(item.product.titleKey)) : `Товар ${item.id}`}
                    </strong>
                    <span className="cart-share-modal__item-qty">x {item.qty}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="cart-share-modal__actions">
              <button
                type="button"
                className="cart-share-modal__button"
                onClick={() => {
                  setIsModalOpen(false)
                  window.dispatchEvent(new Event('cart:open'))
                }}
              >
                Открыть корзину
              </button>
              <button type="button" className="cart-share-modal__secondary" onClick={() => setIsModalOpen(false)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
