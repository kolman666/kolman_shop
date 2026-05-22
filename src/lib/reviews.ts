// Client for /api/reviews. Replaces the old localStorage-only review storage
// so reviews show up across devices.

export type RemoteReview = {
  id: number
  product_id: number
  author_email: string
  author_name: string
  rating: number
  text: string
  photos: string[]
  created_at: string
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `${res.status}`)
  }
  return res.json() as Promise<T>
}

// Ownership-protected branches (?my=, POST, DELETE) require the bearer token
// on the server. Public branches (?product=) ignore it.
const AUTH_TOKEN_KEY = 'kolman-auth-token'
function userHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) }
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (token) headers.Authorization = `Bearer ${token}`
  } catch { /* ignore */ }
  return headers
}

export async function fetchProductReviewsRemote(productId: number): Promise<RemoteReview[]> {
  try {
    return await handle<RemoteReview[]>(
      await fetch(`/api/reviews?product=${productId}`, { cache: 'no-store' }),
    )
  } catch {
    return []
  }
}

export async function fetchMyReviewsRemote(email: string): Promise<RemoteReview[]> {
  try {
    return await handle<RemoteReview[]>(
      await fetch(`/api/reviews?my=${encodeURIComponent(email)}`, {
        cache: 'no-store',
        headers: userHeaders(),
      }),
    )
  } catch {
    return []
  }
}

export async function createReviewRemote(input: {
  productId: number
  email: string
  rating: number
  text: string
  authorName: string
  photos?: string[]
}): Promise<RemoteReview> {
  return handle<RemoteReview>(
    await fetch('/api/reviews', {
      method: 'POST',
      headers: userHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        product_id: input.productId,
        email: input.email,
        rating: input.rating,
        text: input.text,
        author_name: input.authorName,
        photos: input.photos ?? [],
      }),
    }),
  )
}

export async function deleteReviewRemote(id: number, email: string): Promise<void> {
  await handle<{ ok: true }>(
    await fetch('/api/reviews', {
      method: 'DELETE',
      headers: userHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, email }),
    }),
  )
}
