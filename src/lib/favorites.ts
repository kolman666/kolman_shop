const STORAGE_KEY = 'kolman-favorites'
export const FAVORITES_EVENT = 'favorites:update'

function read(): number[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is number => typeof id === 'number')
  } catch {
    return []
  }
}

function write(ids: number[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
  window.dispatchEvent(new Event(FAVORITES_EVENT))
}

export function getFavorites(): number[] {
  return read()
}

export function isFavorite(id: number): boolean {
  return read().includes(id)
}

export function toggleFavorite(id: number): boolean {
  const ids = read()
  const idx = ids.indexOf(id)
  if (idx >= 0) {
    ids.splice(idx, 1)
    write(ids)
    return false
  }
  ids.push(id)
  write(ids)
  return true
}

export function removeFavorite(id: number): void {
  const ids = read().filter((x) => x !== id)
  write(ids)
}

export function getFavoritesCount(): number {
  return read().length
}
