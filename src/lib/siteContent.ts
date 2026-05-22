import { supabase } from './supabase'

export type FetchResult<T> = {
  data: T | null
  error: string | null
  needsMigration: boolean
}

// In-memory cache (per page load) — avoids hammering the API if multiple components
// request the same key in the same tick.
const memCache = new Map<string, { value: unknown; ts: number }>()
const MEM_TTL = 30_000

// sessionStorage cache — keeps content visible across reloads on flaky networks.
const SESSION_PREFIX = 'kolman-content:'
const SESSION_TTL = 10 * 60_000

function readSession<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { value: T; ts: number }
    if (!parsed || typeof parsed.ts !== 'number') return null
    if (Date.now() - parsed.ts > SESSION_TTL) return null
    return parsed.value
  } catch {
    return null
  }
}

function writeSession<T>(key: string, value: T) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(SESSION_PREFIX + key, JSON.stringify({ value, ts: Date.now() }))
  } catch { /* ignore quota errors */ }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function tryFetchOnce<T>(key: string): Promise<FetchResult<T> | null> {
  try {
    // `cache: 'no-store'` works around Safari sometimes serving an old 4xx
    // response from disk cache after a backend deploy.
    const res = await fetch(`/api/site-content?key=${encodeURIComponent(key)}`, { cache: 'no-store' })
    if (res.ok) {
      const body = await res.json() as { key: string; value: T | null }
      return { data: body.value, error: null, needsMigration: false }
    }
    if (res.status === 503) {
      return { data: null, error: null, needsMigration: true }
    }
    if (res.status === 400) {
      // Unknown key — definitive, no point retrying.
      return { data: null, error: 'unknown key', needsMigration: false }
    }
    // 5xx or other — caller retries.
    return null
  } catch {
    return null
  }
}

export async function fetchSiteContent<T>(key: string): Promise<FetchResult<T>> {
  // 1. In-memory hot cache.
  const mem = memCache.get(key)
  if (mem && Date.now() - mem.ts < MEM_TTL) {
    return { data: mem.value as T, error: null, needsMigration: false }
  }

  // Pull session cache up front. If the network round trip below returns
  // empty/null or fails, we'd rather show stale-but-real content than a blank
  // block. This was the reason some sections appeared and disappeared between
  // reloads in Safari.
  const cached = readSession<T>(key)

  // 2. API with one retry on transient failure.
  let apiResult = await tryFetchOnce<T>(key)
  if (!apiResult) {
    await delay(400)
    apiResult = await tryFetchOnce<T>(key)
  }

  if (apiResult) {
    if (apiResult.data !== null) {
      memCache.set(key, { value: apiResult.data, ts: Date.now() })
      writeSession(key, apiResult.data)
      return apiResult
    }
    // API responded but row is empty/null. If we have a previously-cached
    // value, surface it so the block stays visible across short outages or
    // back-end deploys that briefly reject newly-introduced keys.
    if (cached !== null) {
      memCache.set(key, { value: cached, ts: Date.now() })
      return { data: cached, error: null, needsMigration: false }
    }
    return apiResult
  }

  // 3. Direct Supabase client fallback (e.g. local dev without /api routes).
  if (supabase) {
    const { data, error } = await supabase
      .from('site_content')
      .select('value')
      .eq('key', key)
      .single()
    if (!error) {
      const value = (data?.value as T) ?? null
      if (value !== null) {
        memCache.set(key, { value, ts: Date.now() })
        writeSession(key, value)
        return { data: value, error: null, needsMigration: false }
      }
      // Empty row from Supabase — same stale-but-visible policy as above.
      if (cached !== null) {
        memCache.set(key, { value: cached, ts: Date.now() })
        return { data: cached, error: null, needsMigration: false }
      }
      return { data: null, error: null, needsMigration: false }
    }
    if (error.code === 'PGRST116') {
      if (cached !== null) return { data: cached, error: null, needsMigration: false }
      return { data: null, error: null, needsMigration: false }
    }
    const missing = error.message.includes('does not exist') || error.code === '42P01'
    if (missing) return { data: null, error: null, needsMigration: true }
  }

  // 4. Last-resort: previous-session cache so users still see *something*.
  if (cached !== null) {
    memCache.set(key, { value: cached, ts: Date.now() })
    return { data: cached, error: null, needsMigration: false }
  }

  return { data: null, error: 'network', needsMigration: false }
}

export function invalidateSiteContent(key?: string) {
  if (key) {
    memCache.delete(key)
    if (typeof window !== 'undefined') {
      try { sessionStorage.removeItem(SESSION_PREFIX + key) } catch { /* ignore */ }
    }
    return
  }
  memCache.clear()
  if (typeof window !== 'undefined') {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i)
        if (k?.startsWith(SESSION_PREFIX)) sessionStorage.removeItem(k)
      }
    } catch { /* ignore */ }
  }
}

// Fetch content with a language fallback: tries `${baseKey}_${lng}`, then
// `${baseKey}_en` (default), then the legacy unsuffixed `${baseKey}`.
export async function fetchSiteContentLocalized<T>(baseKey: string, lng: string): Promise<FetchResult<T>> {
  const tried: string[] = []
  const langSpecific = await fetchSiteContent<T>(`${baseKey}_${lng}`)
  tried.push(`${baseKey}_${lng}`)
  if (!langSpecific.error && langSpecific.data && (!Array.isArray(langSpecific.data) || langSpecific.data.length > 0)) {
    return langSpecific
  }
  if (langSpecific.needsMigration) return langSpecific

  if (lng !== 'en') {
    const fallbackLang = await fetchSiteContent<T>(`${baseKey}_en`)
    tried.push(`${baseKey}_en`)
    if (!fallbackLang.error && fallbackLang.data && (!Array.isArray(fallbackLang.data) || fallbackLang.data.length > 0)) {
      return fallbackLang
    }
  }

  const legacy = await fetchSiteContent<T>(baseKey)
  return legacy
}

export async function updateSiteContent(key: string, value: unknown): Promise<void> {
  const secret = sessionStorage.getItem('admin_secret') ?? ''
  const res = await fetch('/api/site-content', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
    body: JSON.stringify({ key, value }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? 'Failed to save content')
  }
  // Refresh caches for this key so subsequent reads pick up the new value.
  invalidateSiteContent(key)
}
