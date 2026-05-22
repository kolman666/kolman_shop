// Local-only storage for per-user orders and reviews. Keyed by email so a user
// who logs out and back in keeps their data. No server sync.

const ORDERS_KEY = 'kolman-orders'
const REVIEWS_KEY = 'kolman-reviews'

export const USER_DATA_EVENT = 'userData:update'

export type Order = {
  id: string
  createdAt: number
  total: number
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled'
  items: { productId: number; title: string; qty: number; price: number }[]
}

export type Review = {
  id: string
  createdAt: number
  productId: number
  productTitle: string
  rating: number
  text: string
  authorEmail?: string
  authorName?: string
  // Optional set of customer-uploaded photos, each as a 1024px-max JPEG
  // data URL produced via lib/imageResize.ts. Capped to 6 photos at the UI
  // layer to keep localStorage manageable.
  photos?: string[]
}

type Bucket<T> = Record<string, T[]>

function read<T>(key: string): Bucket<T> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Bucket<T>
  } catch {
    return {}
  }
}

function write<T>(key: string, data: Bucket<T>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
  window.dispatchEvent(new Event(USER_DATA_EVENT))
}

export function getOrders(email: string): Order[] {
  return read<Order>(ORDERS_KEY)[email.toLowerCase()] ?? []
}

export function addOrder(email: string, order: Order) {
  const key = email.toLowerCase()
  const data = read<Order>(ORDERS_KEY)
  data[key] = [order, ...(data[key] ?? [])]
  write(ORDERS_KEY, data)
}

export function getReviews(email: string): Review[] {
  return read<Review>(REVIEWS_KEY)[email.toLowerCase()] ?? []
}

export function addReview(email: string, review: Review) {
  const key = email.toLowerCase()
  const data = read<Review>(REVIEWS_KEY)
  data[key] = [review, ...(data[key] ?? [])]
  write(REVIEWS_KEY, data)
}

export function removeReview(email: string, id: string) {
  const key = email.toLowerCase()
  const data = read<Review>(REVIEWS_KEY)
  data[key] = (data[key] ?? []).filter((r) => r.id !== id)
  write(REVIEWS_KEY, data)
}

// Aggregated view: returns reviews for a product across all users.
export function getProductReviews(productId: number): Review[] {
  const data = read<Review>(REVIEWS_KEY)
  const out: Review[] = []
  for (const [email, list] of Object.entries(data)) {
    for (const r of list) {
      if (r.productId === productId) out.push({ ...r, authorEmail: email })
    }
  }
  return out.sort((a, b) => b.createdAt - a.createdAt)
}
