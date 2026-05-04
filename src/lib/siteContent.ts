import { supabase } from './supabase'

export async function fetchSiteContent<T>(key: string): Promise<T | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('site_content')
    .select('value')
    .eq('key', key)
    .single()
  if (error) return null
  return (data?.value as T) ?? null
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
