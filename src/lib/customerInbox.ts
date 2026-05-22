// Customer-facing client for /api/orders?my= , /api/inquiries?my= , /api/messages.
// Same MVP-auth caveats as the backend: anyone passing a known email can
// fetch that account's data. Acceptable on staging; real production needs
// server-side session auth.

export type RemoteOrder = {
  id: number
  status: 'new' | 'in_progress' | 'done' | 'cancelled'
  total: number
  items: { id: number | null; title: string; price: number; quantity: number }[]
  delivery: string
  comment: string
  created_at: string
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
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function fetchMyOrders(email: string): Promise<RemoteOrder[]> {
  try {
    return await handle<RemoteOrder[]>(await fetch(`/api/orders?my=${encodeURIComponent(email)}`))
  } catch {
    return []
  }
}

export async function fetchMyInquiries(email: string): Promise<RemoteInquiry[]> {
  try {
    return await handle<RemoteInquiry[]>(await fetch(`/api/inquiries?my=${encodeURIComponent(email)}`))
  } catch {
    return []
  }
}

export async function fetchChatMessages(email: string): Promise<ChatMessage[]> {
  try {
    return await handle<ChatMessage[]>(await fetch(`/api/messages?my=${encodeURIComponent(email)}`))
  } catch {
    return []
  }
}

export async function sendChatMessage(email: string, body: string): Promise<ChatMessage> {
  return handle<ChatMessage>(
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, body }),
    }),
  )
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

export async function adminReply(threadEmail: string, body: string): Promise<ChatMessage> {
  return handle<ChatMessage>(
    await fetch('/api/messages', {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({ email: threadEmail, body }),
    }),
  )
}
