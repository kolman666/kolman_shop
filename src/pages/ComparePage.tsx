// Side-by-side product comparison. Reads ids from localStorage (managed by
// lib/compare.ts) and renders a spec table where rows with values that
// differ across columns are highlighted.
//
// Usage flow:
//   1. User clicks "+ к сравнению" on a ProductCard → id added to list.
//   2. A floating bar appears on every page (CompareBar) with a link here.
//   3. /compare renders the table; "удалить" on each column trims the list.

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProducts } from '../hooks/useProducts'
import { getCompare, toggleCompare, clearCompare, COMPARE_EVENT } from '../lib/compare'

export default function ComparePage() {
  const { products } = useProducts()
  const [ids, setIds] = useState<number[]>(() => getCompare())

  useEffect(() => {
    const sync = () => setIds(getCompare())
    window.addEventListener(COMPARE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(COMPARE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const selected = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]))
    return ids.map((id) => byId.get(id)).filter(Boolean) as typeof products
  }, [ids, products])

  // Build a unified set of spec keys from all selected products. Each product
  // exposes a freeform `specs` array of "key: value" strings (catalog) plus a
  // few fixed fields (brand, price, availability, condition).
  const specRows = useMemo(() => {
    if (selected.length === 0) return []
    const rows: Array<{ label: string; values: string[]; diff: boolean }> = []
    const baseFields: Array<{ label: string; get: (p: typeof selected[number]) => string }> = [
      { label: 'Бренд', get: (p) => p.brand },
      { label: 'Цена', get: (p) => `${p.price.toLocaleString('ru-RU')} ₽` },
      { label: 'Категория', get: (p) => p.categoryKey ?? '—' },
      { label: 'В наличии', get: (p) => p.availability === 'inStock' ? 'да' : 'предзаказ' },
      { label: 'Состояние', get: (p) => p.condition ?? '—' },
    ]
    for (const f of baseFields) {
      const values = selected.map(f.get)
      const diff = new Set(values).size > 1
      rows.push({ label: f.label, values, diff })
    }
    // Freeform specs: parse "key: value" lines and zip across products.
    const specKeys = new Set<string>()
    const perProductSpecs = selected.map((p) => {
      const map = new Map<string, string>()
      for (const line of (p.specs ?? []) as string[]) {
        const colon = line.indexOf(':')
        if (colon === -1) map.set(line.trim(), '✓')
        else {
          const k = line.slice(0, colon).trim()
          const v = line.slice(colon + 1).trim()
          if (k) {
            map.set(k, v)
            specKeys.add(k)
          }
        }
      }
      return map
    })
    for (const key of specKeys) {
      const values = perProductSpecs.map((m) => m.get(key) ?? '—')
      const diff = new Set(values).size > 1
      rows.push({ label: key, values, diff })
    }
    return rows
  }, [selected])

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="compare-head">
          <h1>Сравнение</h1>
          <p className="compare-head__sub">
            Отметьте товары в каталоге кнопкой «+ к сравнению» (до 4 штук) — тут увидите все характеристики бок о бок.
          </p>
          {selected.length > 0 && (
            <button type="button" className="ghost-btn" onClick={clearCompare} style={{ marginTop: 12 }}>
              очистить
            </button>
          )}
        </header>

        {selected.length === 0 ? (
          <div className="compare-empty">
            <p>Список сравнения пуст.</p>
            <Link to="/catalog" className="cta-btn" style={{ textDecoration: 'none', width: 'fit-content' }}>
              в каталог
            </Link>
          </div>
        ) : (
          <div className="compare-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th></th>
                  {selected.map((p) => (
                    <th key={p.id} className="compare-col">
                      <Link to={`/product/${p.slug}`} className="compare-col__link">
                        <img src={p.image} alt="" className="compare-col__img" loading="lazy" />
                        <span className="compare-col__title">{p.titleDirect ?? p.brand}</span>
                      </Link>
                      <button
                        type="button"
                        className="compare-col__remove"
                        onClick={() => toggleCompare(p.id)}
                        aria-label="убрать"
                      >×</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {specRows.map((row) => (
                  <tr key={row.label} className={row.diff ? 'compare-row compare-row--diff' : 'compare-row'}>
                    <th scope="row">{row.label}</th>
                    {row.values.map((v, i) => (
                      <td key={i}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
