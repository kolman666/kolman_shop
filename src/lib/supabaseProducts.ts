import { supabase } from './supabase'
import type { Product, VariantGroup } from '../data/products'
import { normalizeVariantGroups } from './variantGroups'

const SUPABASE_ID_OFFSET = 1_000_000
const SESSION_CACHE_KEY = 'kolman-products-cache'
const SESSION_CACHE_TS_KEY = 'kolman-products-cache-ts'
const SESSION_CACHE_TTL = 5 * 60_000 // 5 min — keeps catalog populated across reloads on slow networks

let _cache: Product[] | null = null
let _cacheTs = 0
const CACHE_TTL = 60_000

function hydrateFromSession(): Product[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY)
    const tsRaw = sessionStorage.getItem(SESSION_CACHE_TS_KEY)
    if (!raw || !tsRaw) return null
    const ts = parseInt(tsRaw, 10)
    if (!Number.isFinite(ts)) return null
    if (Date.now() - ts > SESSION_CACHE_TTL) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed as Product[]
  } catch {
    return null
  }
}

function persistToSession(products: Product[]) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(products))
    sessionStorage.setItem(SESSION_CACHE_TS_KEY, String(Date.now()))
  } catch {
    // QuotaExceeded or disabled storage — silent fallback to in-memory only.
  }
}

export function invalidateProductCache() {
  _cache = null
  _cacheTs = 0
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_CACHE_KEY)
      sessionStorage.removeItem(SESSION_CACHE_TS_KEY)
    } catch { /* ignore */ }
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
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
  // First hit of the session: try to hydrate from sessionStorage so users see
  // *something* even if the upcoming network fetch is slow or fails.
  if (!_cache) {
    const hydrated = hydrateFromSession()
    if (hydrated) {
      _cache = hydrated
      _cacheTs = Date.now() - CACHE_TTL + 1 // expires soon so a fresh fetch runs
    }
  }

  if (!supabase) return _cache ?? []

  const now = Date.now()
  if (!forceRefresh && _cache && now - _cacheTs < CACHE_TTL) {
    return _cache
  }

  // Retry once on transient errors. Supabase free tier sometimes cold-starts
  // and returns a 5xx on the first request.
  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase
      .from('admin_products')
      .select('*')
      .order('id', { ascending: false })

    if (!error && data) {
      _cache = (data as ProductRow[]).map(rowToProduct)
      _cacheTs = now
      persistToSession(_cache)
      return _cache
    }

    lastError = error
    if (attempt === 0) await delay(400)
  }

  console.error('[supabase] fetch admin_products failed after retry:', lastError)
  return _cache ?? []
}
