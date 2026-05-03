import type { Product } from '../data/products'

export function productPath(product: Product): string {
  return `/product/${encodeURIComponent(product.slug)}`
}

