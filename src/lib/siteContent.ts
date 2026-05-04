import { supabase } from './supabase'

export type FetchResult<T> = {
  data: T | null
  error: string | null
  needsMigration: boolean
}

export async function fetchSiteContent<T>(key: string): Promise<FetchResult<T>> {
  // API first — uses service role key, bypasses RLS
  try {
    const res = await fetch(`/api/site-content?key=${encodeURIComponent(key)}`)
    if (res.ok) {
      const body = await res.json() as { key: string; value: T | null }
      return { data: body.value, error: null, needsMigration: false }
    }
    if (res.status === 503) {
      return { data: null, error: null, needsMigration: true }
    }
  } catch {
    // API not available (local dev) — fall through
  }

  // Fallback: Supabase client
  if (!supabase) return { data: null, error: 'Supabase not configured', needsMigration: false }
  const { data, error } = await supabase
    .from('site_content')
    .select('value')
    .eq('key', key)
    .single()
  if (error) {
    if (error.code === 'PGRST116') return { data: null, error: null, needsMigration: false }
    const missing = error.message.includes('does not exist') || error.code === '42P01'
    return { data: null, error: error.message, needsMigration: missing }
  }
  return { data: (data?.value as T) ?? null, error: null, needsMigration: false }
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
}
