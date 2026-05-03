const STORAGE_KEY = 'kolman-auth'
export const AUTH_EVENT = 'auth:update'

export type User = {
  name: string
  email: string
}

type StoredAccount = {
  name: string
  password: string
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

export function login(email: string, password: string): User {
  const normalized = email.trim().toLowerCase()
  if (!EMAIL_REGEXP.test(normalized)) {
    throw new AuthError('INVALID_EMAIL')
  }

  const state = readState()
  const account = state.users[normalized]
  if (!account) {
    throw new AuthError('USER_NOT_FOUND')
  }

  if (account.password !== password) {
    throw new AuthError('WRONG_PASSWORD')
  }

  const user: User = { name: account.name, email: normalized }
  writeState({ ...state, currentUser: user })
  return user
}

export function register(name: string, email: string, password: string): User {
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
  const nextState: AuthState = {
    users: {
      ...state.users,
      [normalizedEmail]: { name: cleanName, password },
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
