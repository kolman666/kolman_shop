import { AUTH_EVENT, getUser } from './auth'

// Favorites are scoped per logged-in user (by email). Anonymous favorites are
// kept under the special bucket `__guest` so a visitor can browse and then
// see the same items in their account after registering — at login we merge
// guest favorites into the user's bucket.
const STORAGE_KEY = 'kolman-favorites'
const GUEST_KEY = '__guest'
export const FAVORITES_EVENT = 'favorites:update'

type Bucket = Record<string, number[]>

function read(): Bucket {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    // Legacy: previous version stored a flat array. Migrate it into the guest bucket.
    if (Array.isArray(parsed)) {
      const migrated: Bucket = { [GUEST_KEY]: parsed.filter((id): id is number => typeof id === 'number') }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated)) } catch { /* ignore */ }
      return migrated
    }
    const out: Bucket = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v.filter((id): id is number => typeof id === 'number')
    }
    return out
  } catch {
    return {}
  }
}

function write(bucket: Bucket) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bucket))
  window.dispatchEvent(new Event(FAVORITES_EVENT))
}

function currentBucketKey(): string {
  const user = getUser()
  return user ? user.email.toLowerCase() : GUEST_KEY
}

export function getFavorites(): number[] {
  return read()[currentBucketKey()] ?? []
}

export function isFavorite(id: number): boolean {
  return getFavorites().includes(id)
}

export function toggleFavorite(id: number): boolean {
  const bucket = read()
  const key = currentBucketKey()
  const ids = bucket[key] ?? []
  const idx = ids.indexOf(id)
  if (idx >= 0) {
    ids.splice(idx, 1)
    bucket[key] = ids
    write(bucket)
    return false
  }
  ids.push(id)
  bucket[key] = ids
  write(bucket)
  return true
}

export function removeFavorite(id: number): void {
  const bucket = read()
  const key = currentBucketKey()
  bucket[key] = (bucket[key] ?? []).filter((x) => x !== id)
  write(bucket)
}

export function getFavoritesCount(): number {
  return getFavorites().length
}

// On login, merge any guest favorites into the user bucket so the user keeps
// the items they collected before signing in.
function mergeGuestOnAuthChange() {
  const user = getUser()
  if (!user) return
  const bucket = read()
  const guest = bucket[GUEST_KEY]
  if (!guest || guest.length === 0) return
  const userKey = user.email.toLowerCase()
  const merged = Array.from(new Set([...(bucket[userKey] ?? []), ...guest]))
  bucket[userKey] = merged
  delete bucket[GUEST_KEY]
  write(bucket)
}

if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_EVENT, mergeGuestOnAuthChange)
}
