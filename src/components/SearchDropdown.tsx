import { useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Product } from '../data/products'

export type SearchSection = {
  label: string
  catalogKey: string
}

type Props = {
  open: boolean
  onClose: () => void
  hitProducts: Product[]
  popularSections: SearchSection[]
  anchorRef?: { current: HTMLElement | null }
}

const DEFAULT_SECTIONS: SearchSection[] = [
  { label: 'Клавиатуры', catalogKey: 'products.categories.keyboards' },
  { label: 'Мышки', catalogKey: 'products.categories.mice' },
  { label: 'Коврики', catalogKey: 'products.categories.mousepads' },
  { label: 'Наушники', catalogKey: 'products.categories.headsets' },
  { label: 'Мониторы', catalogKey: '' },
  { label: 'Глайды/Грипсы', catalogKey: 'products.categories.glides' },
  { label: 'Микрофоны', catalogKey: '' },
  { label: 'Кейкапы', catalogKey: '' },
]

export default function SearchDropdown({ open, onClose, hitProducts, popularSections, anchorRef }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const sections = popularSections.length > 0 ? popularSections : DEFAULT_SECTIONS

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (anchorRef?.current && anchorRef.current.contains(target)) return
      if (ref.current && !ref.current.contains(target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, onClose, anchorRef])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  function handleSectionClick(catalogKey: string) {
    onClose()
    navigate(catalogKey ? `/catalog?category=${encodeURIComponent(catalogKey)}` : '/catalog')
  }

  return (
    <div className="search-drop" ref={ref}>
      <div className="search-drop__section">
        <div className="search-drop__section-head">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="search-drop__section-icon search-drop__section-icon--star">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          <span>Популярные разделы</span>
        </div>
        <div className="search-drop__chips">
          {sections.map((s) => (
            <button
              key={s.label}
              type="button"
              className="search-drop__chip"
              onClick={() => handleSectionClick(s.catalogKey)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {hitProducts.length > 0 && (
        <div className="search-drop__section">
          <div className="search-drop__section-head">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="search-drop__section-icon search-drop__section-icon--fire">
              <path d="M12 2c0 0-5 5.5-5 10a5 5 0 0010 0C17 7.5 12 2 12 2zm0 13a2 2 0 01-2-2c0-2 2-4.5 2-4.5s2 2.5 2 4.5a2 2 0 01-2 2z" />
            </svg>
            <span>Хиты</span>
          </div>
          <div className="search-drop__hits">
            {hitProducts.slice(0, 4).map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.slug}`}
                className="search-drop__hit"
                onClick={onClose}
              >
                <div className="search-drop__hit-img-wrap">
                  <img src={p.image} alt={p.titleDirect ?? p.brand} className="search-drop__hit-img" />
                </div>
                <div className="search-drop__hit-body">
                  <span className="search-drop__hit-brand">{p.brand}</span>
                  <span className="search-drop__hit-name">{p.titleDirect ?? p.brand}</span>
                  <strong className="search-drop__hit-price">{p.price.toLocaleString('ru-RU')} ₽</strong>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
