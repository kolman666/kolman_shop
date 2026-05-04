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
  needsMigration: boolean
}

/** Used by the homepage — returns rows or empty array */
export async function fetchBloggers(activeOnly = true): Promise<BloggerRow[]> {
  const result = await fetchBloggersAdmin(activeOnly)
  return result.data
}

/** Used by admin panel — also surfaces migration flag */
export async function fetchBloggersAdmin(activeOnly = false): Promise<FetchBloggersResult> {
  try {
    const res = await fetch('/api/bloggers')
    if (res.ok) {
      const rows = (await res.json()) as BloggerRow[]
      return { data: activeOnly ? rows.filter((r) => r.is_active) : rows, needsMigration: false }
    }
    if (res.status === 503) {
      return { data: [], needsMigration: true }
    }
  } catch {
    // API not available (local dev) — fall through to Supabase client
  }

  if (!supabase) return { data: [], needsMigration: false }
  let query = supabase.from('bloggers').select('*').order('sort_order', { ascending: true })
  if (activeOnly) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) {
    const missing = error.message.includes('does not exist') || error.code === '42P01'
    return { data: [], needsMigration: missing }
  }
  return { data: (data as BloggerRow[]) ?? [], needsMigration: false }
}

export async function createBlogger(input: Omit<BloggerRow, 'id'>): Promise<BloggerRow> {
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

export async function updateBlogger(id: number, updates: Partial<Omit<BloggerRow, 'id'>>): Promise<BloggerRow> {
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
