import { supabase } from './supabase'

export type FetchResult<T> = {
  data: T | null
  error: string | null
}

export async function fetchSiteContent<T>(key: string): Promise<FetchResult<T>> {
  if (!supabase) return { data: null, error: 'Supabase not configured' }
  const { data, error } = await supabase
    .from('site_content')
    .select('value')
    .eq('key', key)
    .single()
  if (error) {
    if (error.code === 'PGRST116') {
      // Not found is not an error
      return { data: null, error: null }
    }
    return { data: null, error: error.message }
  }
  return { data: (data?.value as T) ?? null, error: null }
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
