// Customer-facing client for /api/orders?my= , /api/inquiries?my= , /api/messages.
// All customer ?my= / body.email endpoints are now bearer-token authenticated
// server-side — every fetch from this file therefore sends Authorization:
// Bearer <token>. Without it the server returns 401.

export type RemoteOrder = {
  id: number
  status: 'new' | 'in_progress' | 'done' | 'cancelled'
  total: number
  items: { id: number | null; title: string; price: number; quantity: number }[]
  delivery: string
  comment: string
  created_at: string
  tracking_number?: string | null
  tracking_carrier?: string | null
}

// Build a public tracking URL for the carrier's site, given the tracking
// number. Returns null for unknown carriers.
export function trackingUrl(carrier: string | null | undefined, number: string | null | undefined): string | null {
  if (!number) return null
  const n = encodeURIComponent(number.trim())
  switch ((carrier ?? '').toLowerCase()) {
    case 'cdek':
      return `https://www.cdek.ru/ru/tracking?order_id=${n}`
    case 'post':
      return `https://www.pochta.ru/tracking#${n}`
    case 'avito':
      // Avito doesn't have a public tracker; surface the order page lookup.
      return `https://www.avito.ru/profile/orders?search=${n}`
    default:
      return null
  }
}

export type RemoteInquiry = {
  id: number
  status: 'new' | 'in_progress' | 'done'
  category: 'order' | 'product' | 'choose' | 'delivery' | 'other'
  message: string
  created_at: string
}

export type ChatMessage = {
  id: number
  sender: 'user' | 'admin'
  body: string
  created_at: string
  thread_id?: number | null
  // Client-only field. Lives on the message object purely so the UI can show
  // a "sending / sent / failed" indicator next to the bubble — the server
  // never sets this. Optimistic placeholders use negative IDs so they don't
  // collide with real ones; the reconciler replaces them on ack.
  clientStatus?: 'sending' | 'sent' | 'failed'
}

export type ChatThread = {
  id: number
  user_email: string
  title: string
  status: 'open' | 'closed'
  created_at: string
  last_message_at: string
  // Number of unanswered customer messages since the last admin reply in this
  // thread (admin view) — used by the admin sidebar to show "N new".
  unread_user_messages?: number
  // Number of admin messages newer than the customer's last_user_seen_at
  // (customer view) — used by the account popover to highlight active
  // threads with their last admin response.
  unread_admin_messages?: number
  // Tiny preview of the most recent message (photo markers replaced by 📷)
  // + the sender, so a sidebar / popover can show "вы: ok, отправил" or
  // "поддержка: ваш заказ собран" without an extra round-trip.
  last_message_preview?: string
  last_message_sender?: 'user' | 'admin'
  // First photo data-URL / external URL extracted from the most recent
  // message. Used by the account popover to render a 32×32 thumbnail next
  // to the chat snippet. Undefined when the last message has no photo.
  last_message_photo?: string
  // Optional read-receipt timestamps. Both sides bump their own column when
  // they view the thread (PATCH `?resource=threads` with action=mark_seen).
  // Used to render Telegram-style ✓/✓✓ on outgoing messages: anything sent
  // before the *other* side's seen_at is considered read.
  // Both columns are nullable to keep the feature backwards-compatible — the
  // server silently degrades when the SQL migration hasn't been run.
  last_admin_seen_at?: string | null
  last_user_seen_at?: string | null
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `${res.status}`)
  }
  return res.json() as Promise<T>
}

const AUTH_TOKEN_KEY = 'kolman-auth-token'

// Headers used by every customer-side fetch. Adds `Authorization: Bearer …`
// when the user is logged in so the server can verify ownership of the
// claimed email. Without the token, ownership-protected branches return 401.
function userHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) }
  try {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)
    if (token) headers.Authorization = `Bearer ${token}`
  } catch { /* SSR / private mode */ }
  return headers
}

export async function fetchMyOrders(email: string): Promise<RemoteOrder[]> {
  try {
    return await handle<RemoteOrder[]>(await fetch(
      `/api/orders?my=${encodeURIComponent(email)}`,
      { headers: userHeaders() },
    ))
  } catch {
    return []
  }
}

export async function fetchMyInquiries(email: string): Promise<RemoteInquiry[]> {
  try {
    return await handle<RemoteInquiry[]>(await fetch(
      `/api/inquiries?my=${encodeURIComponent(email)}`,
      { headers: userHeaders() },
    ))
  } catch {
    return []
  }
}

export async function fetchChatMessages(email: string): Promise<ChatMessage[]> {
  try {
    return await handle<ChatMessage[]>(await fetch(
      `/api/messages?my=${encodeURIComponent(email)}`,
      { headers: userHeaders() },
    ))
  } catch {
    return []
  }
}

// Per-thread variants — preferred once the multi-thread schema is live.
export async function fetchThreadMessages(threadId: number): Promise<ChatMessage[]> {
  try {
    return await handle<ChatMessage[]>(await fetch(
      `/api/messages?thread=${threadId}`,
      { headers: userHeaders() },
    ))
  } catch {
    return []
  }
}

export async function sendChatMessage(email: string, body: string, threadId?: number): Promise<ChatMessage> {
  return handle<ChatMessage>(
    await fetch('/api/messages', {
      method: 'POST',
      headers: userHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, body, thread_id: threadId }),
    }),
  )
}

// Customer-facing thread management.
export async function fetchMyThreads(email: string): Promise<ChatThread[]> {
  try {
    return await handle<ChatThread[]>(await fetch(
      `/api/messages?resource=threads&my=${encodeURIComponent(email)}`,
      { headers: userHeaders() },
    ))
  } catch {
    return []
  }
}

export async function createThread(email: string, title: string): Promise<ChatThread> {
  return handle<ChatThread>(
    await fetch('/api/messages?resource=threads', {
      method: 'POST',
      headers: userHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, title }),
    }),
  )
}

export async function setThreadStatus(id: number, email: string, status: 'open' | 'closed'): Promise<ChatThread> {
  return handle<ChatThread>(
    await fetch('/api/messages?resource=threads', {
      method: 'PATCH',
      headers: userHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, email, status }),
    }),
  )
}

// Telemetry-style ping that bumps the caller's "seen at" column on a thread.
// Best-effort: failures (incl. missing schema column) are swallowed so we
// never block UX. Server figures out which column to set from the auth role:
//   - admin → last_admin_seen_at
//   - user  → last_user_seen_at (own thread only)
export async function markThreadSeen(id: number): Promise<void> {
  try {
    await fetch('/api/messages?resource=threads', {
      method: 'PATCH',
      headers: userHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ id, action: 'mark_seen' }),
    })
  } catch { /* network — non-fatal */ }
}

export async function adminMarkThreadSeen(id: number): Promise<void> {
  try {
    await fetch('/api/messages?resource=threads', {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ id, action: 'mark_seen' }),
    })
  } catch { /* non-fatal */ }
}

// Admin-only — uses X-Admin-Secret to identify thread participants.
function adminHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Secret': sessionStorage.getItem('admin_secret') ?? '',
  }
}

export async function adminFetchMessages(threadEmail: string): Promise<ChatMessage[]> {
  return handle<ChatMessage[]>(
    await fetch(`/api/messages?email=${encodeURIComponent(threadEmail)}`, { headers: adminHeaders() }),
  )
}

export async function adminFetchThreadMessages(threadId: number): Promise<ChatMessage[]> {
  return handle<ChatMessage[]>(
    await fetch(`/api/messages?thread=${threadId}`, { headers: adminHeaders() }),
  )
}

export async function adminFetchUserThreads(email: string): Promise<ChatThread[]> {
  return handle<ChatThread[]>(
    await fetch(`/api/messages?resource=threads&email=${encodeURIComponent(email)}`, { headers: adminHeaders() }),
  )
}

export async function adminSetThreadStatus(id: number, status: 'open' | 'closed'): Promise<ChatThread> {
  return handle<ChatThread>(
    await fetch('/api/messages?resource=threads', {
      method: 'PATCH',
      headers: adminHeaders(),
      body: JSON.stringify({ id, status }),
    }),
  )
}

export type AdminThread = {
  email: string
  last_body: string
  last_at: string
  last_sender: 'user' | 'admin'
  unread_user_messages: number
}

// All chat threads, derived from the messages table itself. Replaces the old
// approach of guessing threads from inquiries/orders, which missed customers
// who never placed an order.
export async function adminListThreads(): Promise<AdminThread[]> {
  return handle<AdminThread[]>(
    await fetch('/api/messages?threads=1', { headers: adminHeaders() }),
  )
}

// All chat_threads rows across all customers — used by the admin chat view.
export async function adminListAllChatThreads(): Promise<ChatThread[]> {
  return handle<ChatThread[]>(
    await fetch('/api/messages?resource=threads', { headers: adminHeaders() }),
  )
}

export type UserLookup = {
  name: string
  firstName: string
  lastName: string
  telegram: string
  photo: string
  // ISO timestamp of the last time the user pinged /api/auth?action=heartbeat.
  // Null while the SQL migration adding last_seen_at hasn't been applied yet.
  lastSeenAt: string | null
}

// Batch lookup of public user info for a set of emails. Used by admin chat
// to label threads with the customer's real name + telegram instead of an
// opaque email string.
export async function adminLookupUsers(emails: string[]): Promise<Record<string, UserLookup>> {
  if (emails.length === 0) return {}
  const query = encodeURIComponent(emails.join(','))
  try {
    return await handle<Record<string, UserLookup>>(
      await fetch(`/api/auth?action=lookup&emails=${query}`, { headers: adminHeaders() }),
    )
  } catch {
    return {}
  }
}

export type Customer360 = {
  email: string
  profile: null | {
    id: number
    email: string
    name?: string | null
    first_name?: string | null
    last_name?: string | null
    phone?: string | null
    telegram?: string | null
    photo?: string | null
    last_seen_at?: string | null
    created_at?: string
    updated_at?: string
  }
  orders: Array<{
    id: number
    status: string
    total: number
    items: Array<{ id?: number | null; title: string; price: number; quantity: number }>
    delivery: string
    comment: string
    created_at: string
    tracking_number?: string | null
    tracking_carrier?: string | null
  }>
  inquiries: Array<{ id: number; status: string; category: string; message: string; created_at: string }>
  reviews: Array<{ id: number; product_id: number; rating: number; text: string; photos: string[]; created_at: string }>
  threads: Array<{ id: number; title: string; status: string; created_at: string; last_message_at: string }>
  stats: { ordersCount: number; revenue: number; inquiriesOpen: number }
}

// Admin-only: pulls a 360° view of one customer (profile + orders + inquiries
// + reviews + chat threads) in a single round-trip. Backed by
// /api/auth?action=customer.
export async function adminFetchCustomer(email: string): Promise<Customer360> {
  return handle<Customer360>(
    await fetch(`/api/auth?action=customer&email=${encodeURIComponent(email)}`, { headers: adminHeaders() }),
  )
}

export async function adminReply(threadEmail: string, body: string, threadId?: number): Promise<ChatMessage> {
  return handle<ChatMessage>(
    await fetch('/api/messages', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ email: threadEmail, body, thread_id: threadId }),
    }),
  )
}
