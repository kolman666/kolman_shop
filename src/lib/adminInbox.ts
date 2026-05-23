// Admin-side client for /api/orders and /api/inquiries. Same secret-header auth
// as adminProducts.ts. Both endpoints accept PATCH to change `status`, and the
// Telegram bot writes to the same Supabase rows, so reading here gives you a
// current view of bot activity too.

function adminHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Secret': sessionStorage.getItem('admin_secret') ?? '',
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'request failed' }))
    throw new Error((body as { error?: string }).error ?? `${res.status}`)
  }
  return res.json() as Promise<T>
}

export type OrderStatus = 'new' | 'in_progress' | 'done' | 'cancelled'
export const ORDER_STATUSES: OrderStatus[] = ['new', 'in_progress', 'done', 'cancelled']

export type OrderItem = {
  id: number | null
  title: string
  price: number
  quantity: number
}

export type AdminOrder = {
  id: number
  created_at: string
  status: OrderStatus
  customer_name: string
  customer_contact: string
  customer_email?: string | null
  delivery: string
  comment: string
  total: number
  items: OrderItem[]
  // Set by admin once the parcel is handed to the carrier. Becomes a clickable
  // link in both the admin orders list and the customer's profile.
  tracking_number?: string | null
  tracking_carrier?: 'cdek' | 'post' | 'avito' | string | null
}

export async function updateOrderTracking(id: number, tracking_number: string, tracking_carrier: string): Promise<AdminOrder> {
  return handle<AdminOrder>(
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ id, tracking_number, tracking_carrier }),
    }),
  )
}

export type InquiryStatus = 'new' | 'in_progress' | 'done'
export const INQUIRY_STATUSES: InquiryStatus[] = ['new', 'in_progress', 'done']

export type InquiryCategory = 'order' | 'product' | 'choose' | 'delivery' | 'other'
export const INQUIRY_CATEGORIES: InquiryCategory[] = ['order', 'product', 'choose', 'delivery', 'other']

export type AdminInquiry = {
  id: number
  created_at: string
  status: InquiryStatus
  category: InquiryCategory
  customer_name: string
  customer_contact: string
  message: string
}

export async function listOrders(params: { status?: OrderStatus; limit?: number } = {}): Promise<AdminOrder[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.limit) qs.set('limit', String(params.limit))
  const url = `/api/orders${qs.toString() ? `?${qs.toString()}` : ''}`
  return handle<AdminOrder[]>(await fetch(url, { headers: adminHeaders() }))
}

export async function updateOrderStatus(id: number, status: OrderStatus): Promise<AdminOrder> {
  return handle<AdminOrder>(
    await fetch('/api/orders', {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ id, status }),
    }),
  )
}

export async function deleteOrder(id: number): Promise<void> {
  await handle<{ ok: true }>(
    await fetch('/api/orders', {
      method: 'DELETE',
      headers: adminHeaders(),
      body: JSON.stringify({ id }),
    }),
  )
}

export async function listInquiries(
  params: { status?: InquiryStatus; category?: InquiryCategory; limit?: number } = {},
): Promise<AdminInquiry[]> {
  const qs = new URLSearchParams()
  if (params.status) qs.set('status', params.status)
  if (params.category) qs.set('category', params.category)
  if (params.limit) qs.set('limit', String(params.limit))
  const url = `/api/inquiries${qs.toString() ? `?${qs.toString()}` : ''}`
  return handle<AdminInquiry[]>(await fetch(url, { headers: adminHeaders() }))
}

export async function updateInquiryStatus(id: number, status: InquiryStatus): Promise<AdminInquiry> {
  return handle<AdminInquiry>(
    await fetch('/api/inquiries', {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ id, status }),
    }),
  )
}

export async function deleteInquiry(id: number): Promise<void> {
  await handle<{ ok: true }>(
    await fetch('/api/inquiries', {
      method: 'DELETE',
      headers: adminHeaders(),
      body: JSON.stringify({ id }),
    }),
  )
}
