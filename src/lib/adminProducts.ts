import type { Product } from '../data/products'
import { rowToProduct } from './supabaseProducts'
import type { VariantGroup } from '../data/products'

function getAdminSecret(): string {
  return sessionStorage.getItem('admin_secret') ?? ''
}

function adminHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Secret': getAdminSecret(),
  }
}

async function handleResponse(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'request failed' }))
    throw new Error((body as { error?: string }).error ?? 'request failed')
  }
  return res.json()
}

export type ProductInput = {
  brand: string
  title: string
  description: string
  price: number
  image: string
  gallery: string[]
  availability: 'inStock' | 'preorder'
  category_key: string
  specs: string[]
  variant_groups: VariantGroup[]
  is_featured: boolean
  quantity: number
  // "Before discount" price for regular products. `null` clears it.
  old_price?: number | null
  // Used-marketplace fields (Барахолка). Optional so old call sites still compile.
  is_used?: boolean
  condition?: string
  defects?: string
  // `null` is sent to actively clear the column when a product is un-flagged as
  // used, so previously-typed values don't linger as hidden orphaned data.
  original_price?: number | null
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const row = await handleResponse(
    await fetch('/api/admin-products', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify(input),
    })
  )
  window.dispatchEvent(new Event('admin:update'))
  return rowToProduct(row)
}

export async function updateProduct(id: number, input: Partial<ProductInput>): Promise<Product> {
  const row = await handleResponse(
    await fetch('/api/admin-products', {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ id, ...input }),
    })
  )
  window.dispatchEvent(new Event('admin:update'))
  return rowToProduct(row)
}

export async function deleteProduct(id: number): Promise<void> {
  await handleResponse(
    await fetch('/api/admin-products', {
      method: 'DELETE',
      headers: adminHeaders(),
      body: JSON.stringify({ id }),
    })
  )
  window.dispatchEvent(new Event('admin:update'))
}

export async function verifyAdminSecret(secret: string): Promise<boolean> {
  const res = await fetch('/api/auth?action=admin-auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret }),
  })
  return res.ok
}

export function saveAdminSecret(secret: string): void {
  sessionStorage.setItem('admin_secret', secret)
}

export function clearAdminSecret(): void {
  sessionStorage.removeItem('admin_secret')
}
