import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import { useProducts } from '../hooks/useProducts'
import { productPath } from '../lib/productRoute'

type PriceFilter = 'all' | 'budget' | 'mid' | 'premium'
type SortFilter = 'featured' | 'priceAsc' | 'priceDesc' | 'title'

function matchesPrice(price: number, filter: PriceFilter) {
  if (filter === 'budget') {
    return price < 5000
  }

  if (filter === 'mid') {
    return price >= 5000 && price < 10000
  }

  if (filter === 'premium') {
    return price >= 10000
  }

  return true
}

export default function CatalogPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [selectedPrice, setSelectedPrice] = useState<PriceFilter>('all')
  const [sortBy, setSortBy] = useState<SortFilter>('featured')
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const { products } = useProducts()
  const deferredQuery = useDeferredValue(query)
  const pageSize = 6
  const searchParamsString = searchParams.toString()

  const categoryTabs = useMemo(
    () => ['all', ...new Set(products.map((product) => product.categoryKey))],
    [products],
  )
  const brands = useMemo(
    () => ['all', ...new Set(products.map((product) => product.brand))],
    [products],
  )
  const normalizedQuery = deferredQuery.trim().toLowerCase()

  useEffect(() => {
    const params = new URLSearchParams(searchParamsString)
    const categoryFromUrl = params.get('category')
    const inStockFromUrl = params.get('inStock')
    const featuredFromUrl = params.get('featured')
    const searchFromUrl = params.get('q')

    setActiveCategory(categoryFromUrl && categoryTabs.includes(categoryFromUrl) ? categoryFromUrl : 'all')
    setInStockOnly(inStockFromUrl === '1' || inStockFromUrl === 'true')
    setFeaturedOnly(featuredFromUrl === '1' || featuredFromUrl === 'true')
    setQuery(searchFromUrl ?? '')
    setSelectedBrand('all')
    setSelectedPrice('all')
    setSortBy('featured')
    setPage(1)
  }, [searchParamsString, categoryTabs])

  const filteredProducts = products
    .filter((product) => (activeCategory === 'all' ? true : product.categoryKey === activeCategory))
    .filter((product) => (selectedBrand === 'all' ? true : product.brand === selectedBrand))
    .filter((product) => matchesPrice(product.price, selectedPrice))
    .filter((product) => (featuredOnly ? product.isFeatured : true))
    .filter((product) => (inStockOnly ? product.availability === 'inStock' : true))
    .filter((product) => {
      if (!normalizedQuery) {
        return true
      }

      const haystack = [
        product.titleDirect ?? t(product.titleKey),
        product.descriptionDirect ?? t(product.descriptionKey),
        product.brand,
      ].join(' ').toLowerCase()
      return haystack.includes(normalizedQuery)
    })
    .sort((left, right) => {
      if (sortBy === 'priceAsc') {
        return left.price - right.price
      }

      if (sortBy === 'priceDesc') {
        return right.price - left.price
      }

      if (sortBy === 'title') {
        const leftTitle = left.titleDirect ?? t(left.titleKey)
        const rightTitle = right.titleDirect ?? t(right.titleKey)
        return leftTitle.localeCompare(rightTitle)
      }

      if (Number(Boolean(left.isFeatured)) !== Number(Boolean(right.isFeatured))) {
        return Number(Boolean(right.isFeatured)) - Number(Boolean(left.isFeatured))
      }

      return left.price - right.price
    })

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginatedProducts = filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [activeCategory, selectedBrand, selectedPrice, sortBy, featuredOnly, inStockOnly, deferredQuery])

  const resetFilters = () => {
    setActiveCategory('all')
    setSelectedBrand('all')
    setSelectedPrice('all')
    setSortBy('featured')
    setFeaturedOnly(false)
    setInStockOnly(false)
    setQuery('')
    setPage(1)
  }

  return (
    <main className="catalog-shell">
      <section className="catalog-hero container">
        <div className="catalog-hero__copy">
          <span className="catalog-hero__eyebrow">{t('ui.catalog.eyebrow')}</span>
          <h1 className="catalog-hero__title">{t('ui.catalog.title')}</h1>
          <p className="catalog-hero__note">{t('ui.catalog.note')}</p>
        </div>

        <div className="catalog-hero__stats">
          <span className="catalog-hero__count">{filteredProducts.length}</span>
          <span className="catalog-hero__count-label">{t('ui.catalog.results')}</span>
        </div>
      </section>

      <section className="catalog-toolbar container">
        <label className="catalog-search">
          <span className="catalog-search__label">{t('ui.catalog.searchPlaceholder')}</span>
          <input
            className="catalog-search__input"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('ui.catalog.searchPlaceholder')}
          />
        </label>

        <div className="catalog-tabs" role="tablist" aria-label="catalog categories">
          {categoryTabs.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              className={`catalog-tab ${activeCategory === category ? 'active' : ''}`}
              aria-selected={activeCategory === category}
              onClick={() => setActiveCategory(category)}
            >
              {category === 'all' ? t('ui.catalog.allCategories') : t(category)}
            </button>
          ))}
        </div>
      </section>

      {filteredProducts.length > 0 && (
        <section className="catalog-banner container" aria-label="featured catalog banner">
          <Link to={productPath(filteredProducts[0])} className="catalog-banner__link">
            <div className="catalog-banner__image" style={{ backgroundImage: `url(${filteredProducts[0].image})` }} />
            <div className="catalog-banner__overlay" />
            <div className="catalog-banner__content">
              <h2>{filteredProducts[0].titleDirect ?? t(filteredProducts[0].titleKey)}</h2>
              <p>{filteredProducts[0].descriptionDirect ?? t(filteredProducts[0].descriptionKey)}</p>
            </div>
          </Link>
        </section>
      )}

      <section className="catalog-layout container">
        <aside className="catalog-filters">
          <div className="catalog-filters__panel">
            <div className="catalog-filters__head">
              <h2 className="catalog-filters__title">{t('ui.catalog.filtersTitle')}</h2>
              <button type="button" className="catalog-filters__reset" onClick={resetFilters}>
                {t('ui.catalog.reset')}
              </button>
            </div>

            <label className="catalog-field">
              <span className="catalog-field__label">{t('ui.catalog.brandsLabel')}</span>
              <select className="catalog-field__control" value={selectedBrand} onChange={(event) => setSelectedBrand(event.target.value)}>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand === 'all' ? t('ui.catalog.allCategories') : brand}
                  </option>
                ))}
              </select>
            </label>

            <label className="catalog-field">
              <span className="catalog-field__label">{t('ui.catalog.priceLabel')}</span>
              <select
                className="catalog-field__control"
                value={selectedPrice}
                onChange={(event) => setSelectedPrice(event.target.value as PriceFilter)}
              >
                <option value="all">{t('ui.catalog.priceAny')}</option>
                <option value="budget">{t('ui.catalog.priceBudget')}</option>
                <option value="mid">{t('ui.catalog.priceMid')}</option>
                <option value="premium">{t('ui.catalog.pricePremium')}</option>
              </select>
            </label>

            <label className="catalog-field">
              <span className="catalog-field__label">{t('ui.catalog.sortLabel')}</span>
              <select className="catalog-field__control" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortFilter)}>
                <option value="featured">{t('ui.catalog.sortFeatured')}</option>
                <option value="priceAsc">{t('ui.catalog.sortPriceAsc')}</option>
                <option value="priceDesc">{t('ui.catalog.sortPriceDesc')}</option>
                <option value="title">{t('ui.catalog.sortTitle')}</option>
              </select>
            </label>

            <label className="catalog-toggle">
              <input type="checkbox" checked={featuredOnly} onChange={(event) => setFeaturedOnly(event.target.checked)} />
              <span>{t('ui.catalog.featuredOnly')}</span>
            </label>

            <label className="catalog-toggle">
              <input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} />
              <span>{t('ui.catalog.inStockOnly')}</span>
            </label>
          </div>
        </aside>

        <div className="catalog-content">
          {filteredProducts.length > 0 ? (
            <div className="catalog-grid">
              {paginatedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="catalog-empty">
              <h2 className="catalog-empty__title">{t('ui.catalog.emptyTitle')}</h2>
              <p className="catalog-empty__text">{t('ui.catalog.emptyText')}</p>
              <button type="button" className="catalog-empty__action" onClick={resetFilters}>
                {t('ui.catalog.reset')}
              </button>
            </div>
          )}

          {filteredProducts.length > pageSize && (
            <div className="catalog-pagination">
              <button
                type="button"
                className="catalog-pagination__btn"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={safePage === 1}
              >
                {t('ui.catalog.pagePrev')}
              </button>
              <span className="catalog-pagination__label">
                {t('ui.catalog.pageLabel')} {safePage} / {totalPages}
              </span>
              <button
                type="button"
                className="catalog-pagination__btn"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={safePage === totalPages}
              >
                {t('ui.catalog.pageNext')}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
