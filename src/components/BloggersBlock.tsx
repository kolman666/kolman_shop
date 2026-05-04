import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import type { Product } from '../data/products'
import { productPath } from '../lib/productRoute'
import { fetchBloggers, type BloggerRow } from '../lib/fetchBloggers'

const FALLBACK_BLOGGERS: BloggerRow[] = [
  {
    id: -1,
    name: 'shadowkekw',
    description: 'стример-миллионник с онлайн-аудиторией более 2М. играет на топовых сетапах и тестирует новейшую периферию',
    image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80',
    social_url: 'https://t.me/kolman_shop_bot',
    gear_product_ids: [],
    is_active: true,
    sort_order: 1,
  },
  {
    id: -2,
    name: 'kolman picks',
    description: 'наш собственный выбор — лучшая периферия после многочасового тестирования. только то, во что верим',
    image: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=800&q=80',
    social_url: 'https://t.me/kolman_shop_bot',
    gear_product_ids: [],
    is_active: true,
    sort_order: 2,
  },
]

type Props = {
  products: Product[]
}

export default function BloggersBlock({ products }: Props) {
  const [bloggers, setBloggers] = useState<BloggerRow[]>(FALLBACK_BLOGGERS)
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    fetchBloggers(true).then((rows) => {
      if (rows.length > 0) setBloggers(rows)
    })
  }, [])

  const blogger = bloggers[current]
  const gearProducts = products.filter(
    (p) => p.dbId !== undefined && blogger.gear_product_ids.includes(p.dbId)
  )

  const prev = () => setCurrent((c) => (c - 1 + bloggers.length) % bloggers.length)
  const next = () => setCurrent((c) => (c + 1) % bloggers.length)

  return (
    <section className="bloggers-section">
      <div className="container">
        <div className="bloggers-section__head">
          <div>
            <p className="section-kicker">рекомендуем</p>
            <h2 className="section-title bloggers-section__title">выбор блогеров</h2>
          </div>
          <div className="bloggers-section__controls">
            <div className="bloggers-section__arrows">
              <button
                type="button"
                className="slide-btn"
                onClick={prev}
                disabled={bloggers.length <= 1}
                aria-label="previous blogger"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                className="slide-btn slide-btn--accent"
                onClick={next}
                disabled={bloggers.length <= 1}
                aria-label="next blogger"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
            <div className="bloggers-section__dots">
              {bloggers.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  className={`dot${i === current ? ' active' : ''}`}
                  onClick={() => setCurrent(i)}
                  aria-label={`blogger ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="bloggers-stage">
          {/* Main blogger card */}
          <div
            className="bloggers-card"
            style={blogger.image ? { backgroundImage: `url(${blogger.image})` } : undefined}
          >
            <div className="bloggers-card__overlay" />
            <div className="bloggers-card__content">
              <h3 className="bloggers-card__name">{blogger.name}</h3>
              <p className="bloggers-card__desc">{blogger.description}</p>
              {blogger.social_url && (
                <a
                  href={blogger.social_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bloggers-card__link"
                >
                  посмотреть профиль →
                </a>
              )}
            </div>
          </div>

          {/* Gear panel */}
          <div className="bloggers-gear">
            {gearProducts.length > 0 ? (
              <>
                <div className="bloggers-gear__items">
                  {gearProducts.slice(0, 3).map((p) => (
                    <Link
                      key={p.id}
                      to={productPath(p)}
                      className="bloggers-gear__item"
                    >
                      <div className="bloggers-gear__item-img-wrap">
                        <img
                          className="bloggers-gear__item-img"
                          src={p.image}
                          alt={p.titleDirect ?? p.brand}
                        />
                      </div>
                      <div className="bloggers-gear__item-info">
                        <p className="bloggers-gear__item-name">
                          {p.brand} {p.titleDirect}
                        </p>
                        <span className="bloggers-gear__item-arrow">↗</span>
                      </div>
                    </Link>
                  ))}
                </div>
                <Link to="/catalog" className="bloggers-gear__all">
                  все девайсы →
                </Link>
              </>
            ) : (
              <div className="bloggers-gear__empty">
                <p className="bloggers-gear__empty-text">сетап скоро появится</p>
                <Link to="/catalog" className="bloggers-gear__all">
                  весь каталог →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
