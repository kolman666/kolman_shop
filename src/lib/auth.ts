// Local-only auth: data lives entirely in the browser's localStorage and is
// never sent to a server. Hashing passwords here doesn't authenticate the
// user against anything — it only prevents a casual reader of localStorage
// from harvesting the user's plain-text password (which they likely reuse).
//
// PBKDF2-SHA-256, 150 000 iterations, 16-byte random salt.
const STORAGE_KEY = 'kolman-auth'
export const AUTH_EVENT = 'auth:update'

export type User = {
  name: string
  email: string
}

type StoredAccount = {
  name: string
  // Either { kind: 'pbkdf2', salt, hash, iter } (new) or string (legacy plain password).
  password: string | PasswordRecord
}

type PasswordRecord = {
  kind: 'pbkdf2'
  salt: string // hex
  hash: string // hex
  iter: number
}

type AuthState = {
  users: Record<string, StoredAccount>
  currentUser: User | null
}

export type AuthErrorCode =
  | 'INVALID_EMAIL'
  | 'PASSWORD_TOO_SHORT'
  | 'USER_NOT_FOUND'
  | 'WRONG_PASSWORD'
  | 'USER_EXISTS'

export class AuthError extends Error {
  code: AuthErrorCode
  constructor(code: AuthErrorCode) {
    super(code)
    this.code = code
  }
}

const EMAIL_REGEXP = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PBKDF2_ITER = 150_000
const PBKDF2_KEYLEN = 32 // bytes
const SALT_LEN = 16

function bytesToHex(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (let i = 0; i < arr.length; i++) {
    const h = arr[i].toString(16)
    s += h.length === 1 ? '0' + h : h
  }
  return s
}

function hexToBytes(hex: string): Uint8Array {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return arr
}

async function pbkdf2(password: string, salt: Uint8Array, iter: number, keylen: number): Promise<Uint8Array> {
  const subtle = (globalThis.crypto && globalThis.crypto.subtle) || null
  if (!subtle) {
    // Hard-fail rather than silently storing plain text.
    throw new Error('crypto.subtle not available — cannot hash password')
  }
  const enc = new TextEncoder()
  const passwordBytes = enc.encode(password)
  // Cast to BufferSource — modern lib.dom typings narrow buffer to ArrayBuffer; runtime is fine.
  const key = await subtle.importKey('raw', passwordBytes as unknown as BufferSource, { name: 'PBKDF2' }, false, ['deriveBits'])
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: iter, hash: 'SHA-256' },
    key,
    keylen * 8,
  )
  return new Uint8Array(bits)
}

async function makePasswordRecord(password: string): Promise<PasswordRecord> {
  const salt = new Uint8Array(SALT_LEN)
  globalThis.crypto.getRandomValues(salt)
  const hash = await pbkdf2(password, salt, PBKDF2_ITER, PBKDF2_KEYLEN)
  return { kind: 'pbkdf2', salt: bytesToHex(salt), hash: bytesToHex(hash), iter: PBKDF2_ITER }
}

async function verifyPassword(password: string, stored: string | PasswordRecord): Promise<boolean> {
  if (typeof stored === 'string') {
    // Legacy plain-text fallback for accounts created before hashing was added.
    return stored === password
  }
  if (!stored || stored.kind !== 'pbkdf2') return false
  const salt = hexToBytes(stored.salt)
  const computed = await pbkdf2(password, salt, stored.iter, stored.hash.length / 2)
  const expected = hexToBytes(stored.hash)
  if (computed.length !== expected.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i++) diff |= computed[i] ^ expected[i]
  return diff === 0
}

function readState(): AuthState {
  if (typeof window === 'undefined') {
    return { users: {}, currentUser: null }
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return { users: {}, currentUser: null }
    }

    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return { users: {}, currentUser: null }
    }

    const candidate = parsed as Partial<AuthState>
    const users =
      candidate.users && typeof candidate.users === 'object'
        ? (candidate.users as Record<string, StoredAccount>)
        : {}
    const currentUser =
      candidate.currentUser &&
      typeof candidate.currentUser === 'object' &&
      typeof (candidate.currentUser as User).email === 'string'
        ? (candidate.currentUser as User)
        : null

    return { users, currentUser }
  } catch {
    return { users: {}, currentUser: null }
  }
}

function writeState(state: AuthState) {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  window.dispatchEvent(new Event(AUTH_EVENT))
}

export function getUser(): User | null {
  return readState().currentUser
}

export async function login(email: string, password: string): Promise<User> {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_REGEXP.test(normalized)) {
    throw new AuthError('INVALID_EMAIL')
  }

  const state = readState()
  const account = state.users[normalized]
  if (!account) {
    throw new AuthError('USER_NOT_FOUND')
  }

  const ok = await verifyPassword(password, account.password)
  if (!ok) {
    throw new AuthError('WRONG_PASSWORD')
  }

  // Upgrade legacy plain-text storage to PBKDF2 transparently.
  if (typeof account.password === 'string') {
    try {
      const record = await makePasswordRecord(password)
      writeState({
        ...state,
        users: { ...state.users, [normalized]: { name: account.name, password: record } },
      })
    } catch {
      // crypto unavailable — leave as is rather than failing login
    }
  }

  const user: User = { name: account.name, email: normalized }
  const latest = readState()
  writeState({ ...latest, currentUser: user })
  return user
}

export async function register(name: string, email: string, password: string): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!EMAIL_REGEXP.test(normalizedEmail)) {
    throw new AuthError('INVALID_EMAIL')
  }

  if (password.length < 8) {
    throw new AuthError('PASSWORD_TOO_SHORT')
  }

  const state = readState()
  if (state.users[normalizedEmail]) {
    throw new AuthError('USER_EXISTS')
  }

  const cleanName = name.trim() || normalizedEmail.split('@')[0]
  const record = await makePasswordRecord(password)
  const nextState: AuthState = {
    users: {
      ...state.users,
      [normalizedEmail]: { name: cleanName, password: record },
    },
    currentUser: { name: cleanName, email: normalizedEmail },
  }

  writeState(nextState)
  return nextState.currentUser as User
}

export function logout() {
  const state = readState()
  writeState({ ...state, currentUser: null })
}
