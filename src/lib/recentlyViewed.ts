// Tiny localStorage-backed ring buffer of recently viewed product slugs.
// Used by the product page to log a visit and by the home / profile pages
// (and the product page itself, under the related-items block) to show the
// last few items the shopper looked at.

const KEY = 'kolman-recently-viewed'
const MAX = 12
export const RECENTLY_VIEWED_EVENT = 'recently-viewed:update'

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string').slice(0, MAX) : []
  } catch { return [] }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
    window.dispatchEvent(new Event(RECENTLY_VIEWED_EVENT))
  } catch { /* quota / SSR */ }
}

export function getRecentlyViewed(): string[] {
  return read()
}

// Log a product visit. Idempotent within a session: moves an existing entry
// to the front rather than duplicating.
export function logRecentlyViewed(slug: string | undefined | null) {
  if (!slug) return
  const list = read()
  const idx = list.indexOf(slug)
  if (idx === 0) return // already at front; nothing to do
  if (idx > 0) list.splice(idx, 1)
  list.unshift(slug)
  write(list)
}

export function clearRecentlyViewed() {
  write([])
}
