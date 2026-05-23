import { useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Product } from '../data/products'
import { fuzzySearch } from '../lib/search'

export type SearchSection = {
  label: string
  catalogKey: string
}

type Props = {
  open: boolean
  onClose: () => void
  hitProducts: Product[]
  // Full catalog used when there's a non-empty query — we score against
  // brand + title + slug for autocomplete-style matches.
  allProducts?: Product[]
  // Current query string typed into the search input. When non-empty the
  // dropdown replaces "Хиты" with matched products from `allProducts`.
  query?: string
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

export default function SearchDropdown({ open, onClose, hitProducts, allProducts, query, popularSections, anchorRef }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const closeDropdown = useEffectEvent(onClose)

  const sections = popularSections.length > 0 ? popularSections : DEFAULT_SECTIONS

  // Build the autocomplete result set whenever the query changes. Each
  // product contributes a haystack of brand + title + slug + categoryKey.
  const matched = useMemo(() => {
    const q = (query ?? '').trim()
    if (!q || !allProducts || allProducts.length === 0) return []
    type Hit = Product & { haystack: string[] }
    const scored = fuzzySearch<Hit>(
      allProducts.map((p) => ({
        ...p,
        haystack: [p.brand ?? '', p.titleDirect ?? '', p.slug ?? '', String(p.id), p.categoryKey ?? ''],
      })),
      q,
      8,
    )
    return scored
  }, [allProducts, query])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      const target = e.target as Node
      if (anchorRef?.current && anchorRef.current.contains(target)) return
      if (ref.current && !ref.current.contains(target)) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDropdown()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

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

      {(() => {
        // Three states: typing → autocomplete (matched), nothing typed →
        // featured hits, no matches → "ничего не найдено" hint.
        if ((query ?? '').trim().length >= 2) {
          if (matched.length === 0) {
            return (
              <div className="search-drop__section">
                <p className="search-drop__empty">Ничего не найдено по запросу «{query}»</p>
              </div>
            )
          }
          return (
            <div className="search-drop__section">
              <div className="search-drop__section-head">
                <span>Найдено</span>
              </div>
              <div className="search-drop__hits">
                {matched.map((p) => (
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
          )
        }
        if (hitProducts.length > 0) {
          return (
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
          )
        }
        return null
      })()}
    </div>
  )
}
