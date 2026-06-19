// Server-side auth client.
//
// Accounts now live in Supabase (auth_users). The client only keeps a
// short-lived bearer token in localStorage and the public user record cached
// in memory. The token is renewed by re-logging in; it expires after 30 days
// server-side.
//
// The old localStorage-only auth from previous iterations is intentionally
// dropped: accounts didn't survive private mode, ITP, or device switches.
// Users will need to register again once the new auth_users table is live.

const TOKEN_KEY = 'kolman-auth-token'
const USER_KEY = 'kolman-auth-user'
export const AUTH_EVENT = 'auth:update'

export type User = {
  id: number
  email: string
  name: string
  firstName?: string
  lastName?: string
  phone?: string
  photo?: string
  telegram?: string
  // Only present after the auth_users.last_seen_at migration is applied.
  // Used by the profile to show the user their own "в сети / был X назад".
  lastSeenAt?: string | null
}

export type AuthErrorCode =
  | 'INVALID_EMAIL'
  | 'PASSWORD_TOO_SHORT'
  | 'PASSWORD_TOO_LONG'
  | 'USER_NOT_FOUND'
  | 'WRONG_PASSWORD'
  | 'USER_EXISTS'
  | 'INVALID_TELEGRAM'
  | 'INVALID_PHOTO'
  | 'PHOTO_TOO_LARGE'
  | 'TABLE_NOT_FOUND'
  | 'NETWORK'
  | 'UNAUTHORIZED'

export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode) {
    super(code)
    this.code = code
  }
}

// ── Local cache of the public user record ──
let memoryUser: User | null = null

function readUserCache(): User | null {
  if (memoryUser) return memoryUser
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as User
    if (parsed && typeof parsed === 'object' && typeof parsed.email === 'string') {
      memoryUser = parsed
      return parsed
    }
  } catch { /* ignore */ }
  return null
}

function writeUserCache(user: User | null) {
  memoryUser = user
  if (typeof window === 'undefined') return
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
    else localStorage.removeItem(USER_KEY)
  } catch { /* quota etc. — ignore */ }
}

function readToken(): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

function writeToken(token: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch { /* ignore */ }
}

function emitAuthEvent() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_EVENT))
}

async function callApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    })
  } catch {
    throw new AuthError('NETWORK')
  }
  let body: { error?: string; user?: User; token?: string; ok?: boolean } = {}
  try { body = await res.json() } catch { /* ignore */ }
  if (!res.ok) {
    const code = (body.error ?? '').toUpperCase()
    if (code === 'TABLE_NOT_FOUND' || code === 'table_not_found'.toUpperCase()) {
      throw new AuthError('TABLE_NOT_FOUND')
    }
    if (code === 'UNAUTHORIZED' || res.status === 401) {
      // Token is bad / expired — clear local state so the UI shows logged-out.
      writeToken(null)
      writeUserCache(null)
      emitAuthEvent()
      throw new AuthError('UNAUTHORIZED')
    }
    if (
      code === 'INVALID_EMAIL' || code === 'PASSWORD_TOO_SHORT' || code === 'PASSWORD_TOO_LONG' ||
      code === 'USER_NOT_FOUND' || code === 'WRONG_PASSWORD' || code === 'USER_EXISTS' ||
      code === 'INVALID_TELEGRAM' || code === 'INVALID_PHOTO' || code === 'PHOTO_TOO_LARGE'
    ) {
      throw new AuthError(code as AuthErrorCode)
    }
    throw new AuthError('NETWORK')
  }
  return body as unknown as T
}

function authHeaders(): Record<string, string> {
  const t = readToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

// ── Public API ──

export function getUser(): User | null {
  return readUserCache()
}

export function getToken(): string | null {
  return readToken()
}

export async function register(name: string, email: string, password: string): Promise<User> {
  const body = await callApi<{ token: string; user: User }>('/api/auth?action=register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
  writeToken(body.token)
  writeUserCache(body.user)
  emitAuthEvent()
  return body.user
}

export async function login(email: string, password: string): Promise<User> {
  const body = await callApi<{ token: string; user: User }>('/api/auth?action=login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  writeToken(body.token)
  writeUserCache(body.user)
  emitAuthEvent()
  return body.user
}

// Background refresh of the cached user (token validation + latest fields).
// Returns null silently on any auth error so callers can use it on app boot.
export async function refreshUser(): Promise<User | null> {
  if (!readToken()) return null
  try {
    const body = await callApi<{ user: User }>('/api/auth?action=me', {
      method: 'GET',
      headers: authHeaders(),
    })
    writeUserCache(body.user)
    emitAuthEvent()
    return body.user
  } catch (err) {
    if (err instanceof AuthError && err.code === 'UNAUTHORIZED') return null
    // On network / table-missing, keep showing the cached user so the UI
    // doesn't flicker — the next interaction will reveal the problem.
    return readUserCache()
  }
}

export async function updateProfile(patch: Partial<Omit<User, 'id' | 'email'>>): Promise<User> {
  const body = await callApi<{ user: User }>('/api/auth?action=profile', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(patch),
  })
  writeUserCache(body.user)
  emitAuthEvent()
  return body.user
}

// Fetches (creating on first call) the signed-in user's personal referral
// code + how many times it's been used. Returns null if not logged in / on error.
export async function getReferral(): Promise<{ code: string; uses: number; percent: number } | null> {
  if (!readToken()) return null
  try {
    return await callApi<{ code: string; uses: number; percent: number }>('/api/auth?action=referral', {
      method: 'POST',
      headers: authHeaders(),
    })
  } catch {
    return null
  }
}

export function logout() {
  writeToken(null)
  writeUserCache(null)
  emitAuthEvent()
  void fetch('/api/auth?action=logout', { method: 'POST', headers: authHeaders() }).catch(() => { /* ignore */ })
}
