import { Link } from 'react-router-dom'
import type { Product } from '../data/products'
import { productPath } from '../lib/productRoute'

type Props = {
  products: Product[]
  brandSlug: string
  brandLabel: string
  tagline: string
  bannerImage?: string
}

export default function BrandSpotlight({ products, brandSlug, brandLabel, tagline, bannerImage }: Props) {
  const brandProducts = products.filter(
    (p) => p.brand.toLowerCase().replace(/\s+/g, '') === brandSlug.toLowerCase().replace(/\s+/g, '')
  )
  if (brandProducts.length === 0) return null

  return (
    <section className="brand-spotlight">
      <div className="brand-spotlight__inner">
        <div className="brand-spotlight__top">
          <h2 className="brand-spotlight__name">{brandLabel}</h2>
          <Link
            to={`/catalog?q=${encodeURIComponent(brandSlug)}`}
            className="brand-spotlight__cta"
          >
            перейти к бренду →
          </Link>
        </div>

        <div
          className="brand-spotlight__banner"
          style={bannerImage ? { backgroundImage: `url(${bannerImage})` } : undefined}
        >
          <div className="brand-spotlight__banner-overlay" />
          <p className="brand-spotlight__tagline">{tagline}</p>
        </div>

        <div className="brand-spotlight__products">
          {brandProducts.map((product) => (
            <Link
              key={product.id}
              to={productPath(product)}
              className="brand-spotlight__card"
            >
              <div className="brand-spotlight__card-img-wrap">
                <img
                  className="brand-spotlight__card-img"
                  src={product.image}
                  alt={product.titleDirect ?? product.brand}
                />
                {product.availability === 'inStock' && (
                  <span className="brand-spotlight__card-badge">в наличии</span>
                )}
              </div>
              <div className="brand-spotlight__card-body">
                <p className="brand-spotlight__card-meta">{product.brand}</p>
                <p className="brand-spotlight__card-title">{product.titleDirect ?? product.brand}</p>
                {product.specs && product.specs.length > 0 && (
                  <div className="brand-spotlight__card-specs">
                    {product.specs.slice(0, 2).map((s) => (
                      <span key={s} className="brand-spotlight__card-spec">{s}</span>
                    ))}
                  </div>
                )}
                <strong className="brand-spotlight__card-price">
                  {product.price.toLocaleString('ru-RU')} rub
                </strong>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
