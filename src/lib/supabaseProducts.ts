import { supabase } from './supabase'
import type { Product, VariantGroup } from '../data/products'
import { normalizeVariantGroups } from './variantGroups'

const SUPABASE_ID_OFFSET = 1_000_000

let _cache: Product[] | null = null
let _cacheTs = 0
const CACHE_TTL = 60_000

export function invalidateProductCache() {
  _cache = null
  _cacheTs = 0
}

export type ProductRow = {
  id: number
  slug: string
  brand: string
  title: string
  description: string
  price: number
  image: string
  gallery: string[]
  availability: 'inStock' | 'preorder'
  category_key: string
  specs: string[]
  variant_groups?: VariantGroup[]
  is_featured: boolean
  quantity: number
}

export function rowToProduct(row: ProductRow): Product {
  return {
    // Keep client-side ids unique to avoid collisions with static catalog ids.
    id: SUPABASE_ID_OFFSET + row.id,
    dbId: row.id,
    slug: row.slug,
    brand: row.brand,
    price: row.price,
    image: row.image,
    gallery: (row.gallery as unknown as string[]) ?? [],
    availability: row.availability,
    categoryKey: row.category_key,
    titleKey: 'admin.placeholder.title',
    titleDirect: row.title,
    descriptionKey: 'admin.placeholder.description',
    descriptionDirect: row.description,
    specs: (row.specs as unknown as string[]) ?? [],
    variantGroups: normalizeVariantGroups(row.variant_groups),
    isFeatured: row.is_featured,
    quantity: row.quantity,
    isAdminCreated: true,
  }
}

export async function fetchSupabaseProducts(forceRefresh = false): Promise<Product[]> {
  if (!supabase) return []

  const now = Date.now()
  if (!forceRefresh && _cache && now - _cacheTs < CACHE_TTL) {
    return _cache
  }

  const { data, error } = await supabase
    .from('admin_products')
    .select('*')
    .order('id', { ascending: false })

  if (error) {
    console.error('[supabase] fetch admin_products failed:', error.message, error)
    return _cache ?? []
  }

  if (!data) return _cache ?? []

  _cache = (data as ProductRow[]).map(rowToProduct)
  _cacheTs = now
  return _cache
}
