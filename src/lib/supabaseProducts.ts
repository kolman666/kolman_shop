import { supabase } from './supabase'
import type { Product, VariantGroup } from '../data/products'
import { normalizeVariantGroups } from './variantGroups'

// Why long-lived localStorage cache?
//
// Free-tier Supabase + Vercel cold starts can take 5+ seconds, and on bad
// mobile networks the first /rest call sometimes drops outright. Before this
// hardening, a transient failure on initial page load meant the entire
// catalog rendered as empty until the user manually reloaded — that's the
// "products disappeared" report.
//
// New behaviour:
//   1. Hydrate from localStorage on first call → user always sees the last
//      known good catalog instantly, even before any network call.
//   2. Background-refresh: even when a cache hit is served, we kick off a
//      revalidation so admins get fresh data within seconds. Listeners can
//      subscribe to `PRODUCTS_EVENT` to repaint when the refresh finishes.
//   3. Retries with exponential backoff (400ms, 1.2s, 3s) before giving up.
//   4. On failure we never wipe the cache — last known data stays visible
//      until a successful refetch.

const SUPABASE_ID_OFFSET = 1_000_000
const CACHE_KEY = 'kolman-products-cache'
const CACHE_TS_KEY = 'kolman-products-cache-ts'
// Long TTL: a day of last-known catalog is fine if network is broken; the
// background refresh catches drift quickly when it works.
const PERSIST_TTL = 24 * 60 * 60_000
// Short in-memory TTL used to skip duplicate fetches within a single page
// load.
const MEMORY_TTL = 30_000

export const PRODUCTS_EVENT = 'products:update'

let _cache: Product[] | null = null
let _cacheTs = 0
let _refreshing: Promise<Product[]> | null = null

function readPersisted(): Product[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    const tsRaw = localStorage.getItem(CACHE_TS_KEY)
    if (!raw || !tsRaw) return null
    const ts = parseInt(tsRaw, 10)
    if (!Number.isFinite(ts)) return null
    if (Date.now() - ts > PERSIST_TTL) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed as Product[]
  } catch {
    return null
  }
}

function writePersisted(products: Product[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(products))
    localStorage.setItem(CACHE_TS_KEY, String(Date.now()))
  } catch {
    // QuotaExceeded or disabled storage — silent fallback to in-memory only.
  }
}

function emitUpdate() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PRODUCTS_EVENT))
}

export function invalidateProductCache() {
  _cache = null
  _cacheTs = 0
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_KEY)
      localStorage.removeItem(CACHE_TS_KEY)
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
  is_used?: boolean
  condition?: string
  defects?: string
  original_price?: number
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
    isUsed: row.is_used ?? false,
    condition: row.condition ?? undefined,
    defects: row.defects ?? undefined,
    originalPrice: row.original_price ?? undefined,
  }
}

// Network fetch with retries. Returns null if every attempt failed — caller
// is responsible for falling back to whatever cache it still has.
async function networkFetchWithRetry(): Promise<Product[] | null> {
  if (!supabase) return null
  // Three attempts spaced by exponential backoff. Total worst-case ~5s.
  const delays = [0, 400, 1200, 3000]
  let lastError: unknown = null
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await delay(delays[attempt])
    const { data, error } = await supabase
      .from('admin_products')
      .select('*')
      .order('id', { ascending: false })
    if (!error && data) {
      return (data as ProductRow[]).map(rowToProduct)
    }
    lastError = error
  }
  console.warn('[supabase] admin_products fetch failed after retries:', lastError)
  return null
}

async function refresh(): Promise<Product[]> {
  if (_refreshing) return _refreshing
  _refreshing = (async () => {
    try {
      const fresh = await networkFetchWithRetry()
      if (fresh) {
        _cache = fresh
        _cacheTs = Date.now()
        writePersisted(fresh)
        emitUpdate()
        return fresh
      }
      return _cache ?? []
    } finally {
      _refreshing = null
    }
  })()
  return _refreshing
}

export async function fetchSupabaseProducts(forceRefresh = false): Promise<Product[]> {
  // 1. Hydrate from localStorage on the very first call of the session. The
  //    user sees the last known catalog before any network call even starts.
  if (!_cache) {
    const persisted = readPersisted()
    if (persisted) {
      _cache = persisted
      _cacheTs = 0 // mark in-memory cache as stale so the background refresh runs
    }
  }

  // 2. Fast in-memory hit — multiple components mounting at once don't re-fetch.
  if (!forceRefresh && _cache && Date.now() - _cacheTs < MEMORY_TTL) {
    return _cache
  }

  // 3. If we have any cache at all (persisted), serve it immediately and
  //    refresh in the background. UI gets instant content; admins still see
  //    fresh data within a few seconds.
  if (!forceRefresh && _cache) {
    void refresh()
    return _cache
  }

  // 4. No cache yet — block on the network fetch.
  const fresh = await refresh()
  return fresh
}
