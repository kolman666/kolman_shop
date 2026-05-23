const CART_STORAGE_KEY = 'kolman-cart'

export const CART_SHARE_IMPORTED_EVENT = 'cart:share-imported'

export type CartImportResult = {
  imported: boolean
  count: number
}

type CartRecord = Record<string, number>

function readCart(): CartRecord {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY)
    if (!raw) {
      return {}
    }

    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }

    const result: CartRecord = {}
    Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
      if (typeof value === 'number' && value > 0) {
        result[key] = Math.floor(value)
      }
    })
    return result
  } catch {
    return {}
  }
}

function writeCart(cart: CartRecord) {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
  window.dispatchEvent(new Event('cart:update'))
}

export function getCartCount() {
  return Object.values(readCart()).reduce((acc, qty) => acc + qty, 0)
}

export function getCart(): CartRecord {
  return readCart()
}

export function addToCart(productId: number, quantity = 1) {
  const cart = readCart()
  const key = String(productId)
  cart[key] = (cart[key] ?? 0) + quantity
  writeCart(cart)
}

export function updateQuantity(productId: number, quantity: number) {
  const cart = readCart()
  const key = String(productId)
  if (quantity <= 0) {
    delete cart[key]
  } else {
    cart[key] = Math.floor(quantity)
  }
  writeCart(cart)
}

export function removeFromCart(productId: number) {
  const cart = readCart()
  const key = String(productId)
  if (key in cart) {
    delete cart[key]
    writeCart(cart)
  }
}

export function clearCart() {
  writeCart({})
}

// ── Share cart via URL ─────────────────────────────────────────────────────
// Encode the current cart contents into a short URL fragment that any other
// user can paste — the importCartFromUrl below picks it up on page load and
// merges into the receiver's cart. Used by CartDrawer's "поделиться" button.
//
// Encoding (compact, URL-safe): pairs of `id:qty` joined by `,`. Example:
//   ?share-cart=12:1,45:2
export function encodeCartForShare(cart: CartRecord): string {
  return Object.entries(cart)
    .filter(([_, q]) => q > 0)
    .map(([id, q]) => `${id}:${q}`)
    .join(',')
}

export function buildShareCartUrl(cart: CartRecord = readCart()): string {
  const encoded = encodeCartForShare(cart)
  if (!encoded) return ''
  const url = new URL('/', window.location.origin)
  url.searchParams.set('share-cart', encoded)
  return url.toString()
}

// Event fired by `importCartFromUrl()` after a successful merge. Listened to
// by the `<ShareCartImportToast>` modal so we can show the receiver what
// landed in their cart instead of doing it silently.
export const SHARE_CART_IMPORTED_EVENT = 'cart:share-imported'

// Called on load and on SPA navigations. If `?share-cart=` is present, merge
// items into localStorage and strip the param so refresh won't double-import.
// Also dispatches a CustomEvent with the imported `{ id → qty }` map so the
// UI can pop the modal once products are loaded.
export function importCartFromUrl(): CartImportResult {
  if (typeof window === 'undefined') return { imported: false, count: 0 }
  const params = new URLSearchParams(window.location.search)
  const raw = params.get('share-cart')
  if (!raw) return { imported: false, count: 0 }
  const incoming: CartRecord = {}
  for (const pair of raw.split(',')) {
    const trimmed = pair.trim()
    if (!trimmed) continue
    const colon = trimmed.indexOf(':')
    const idStr = colon >= 0 ? trimmed.slice(0, colon) : trimmed
    const qStr = colon >= 0 ? trimmed.slice(colon + 1) : '1'
    const id = Number(idStr)
    const q = Math.min(Math.max(Number(qStr) || 1, 1), 99)
    if (Number.isInteger(id) && id > 0) incoming[String(id)] = q
  }
  const count = Object.keys(incoming).length
  if (count === 0) return { imported: false, count: 0 }
  const merged = { ...readCart() }
  for (const [id, q] of Object.entries(incoming)) {
    merged[id] = (merged[id] ?? 0) + q
  }
  writeCart(merged)
  params.delete('share-cart')
  const qs = params.toString()
  const cleanUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash
  window.history.replaceState(null, '', cleanUrl)
  // Notify the UI — the modal listens for this event and looks up product
  // details once `useProducts` has hydrated.
  window.dispatchEvent(new CustomEvent(SHARE_CART_IMPORTED_EVENT, { detail: { items: incoming } }))
  return { imported: true, count }
}
