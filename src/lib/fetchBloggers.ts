import { supabase } from './supabase'

export type BloggerRow = {
  id: number
  name: string
  description: string
  image: string
  social_url: string
  gear_product_ids: number[]
  is_active: boolean
  sort_order: number
}

export type FetchBloggersResult = {
  data: BloggerRow[]
  error: string | null
}

export async function fetchBloggers(activeOnly = true): Promise<BloggerRow[]> {
  if (!supabase) return []
  let query = supabase.from('bloggers').select('*').order('sort_order', { ascending: true })
  if (activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) return []
  return (data as BloggerRow[]) ?? []
}

export async function fetchBloggersWithError(activeOnly = true): Promise<FetchBloggersResult> {
  if (!supabase) return { data: [], error: 'Supabase not configured' }
  let query = supabase.from('bloggers').select('*').order('sort_order', { ascending: true })
  if (activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) {
    return { data: [], error: error.message }
  }
  return { data: (data as BloggerRow[]) ?? [], error: null }
}

export async function createBlogger(
  input: Omit<BloggerRow, 'id'>
): Promise<BloggerRow> {
  const secret = sessionStorage.getItem('admin_secret') ?? ''
  const res = await fetch('/api/bloggers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? 'Failed to create blogger')
  }
  return res.json() as Promise<BloggerRow>
}

export async function updateBlogger(
  id: number,
  updates: Partial<Omit<BloggerRow, 'id'>>
): Promise<BloggerRow> {
  const secret = sessionStorage.getItem('admin_secret') ?? ''
  const res = await fetch('/api/bloggers', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
    body: JSON.stringify({ id, ...updates }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? 'Failed to update blogger')
  }
  return res.json() as Promise<BloggerRow>
}

export async function deleteBlogger(id: number): Promise<void> {
  const secret = sessionStorage.getItem('admin_secret') ?? ''
  const res = await fetch('/api/bloggers', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
    body: JSON.stringify({ id }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? 'Failed to delete blogger')
  }
}
