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
