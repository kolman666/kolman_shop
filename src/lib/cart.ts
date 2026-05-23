const CART_STORAGE_KEY = 'kolman-cart'

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
  if (!encoded) return location.origin + '/'
  const url = new URL('/', location.origin)
  url.searchParams.set('share-cart', encoded)
  return url.toString()
}

// Called once on app load. If `?share-cart=` is present, merge the encoded
// items into the local cart (adding to existing quantities) and clean the URL.
// Returns true when something was imported, so the UI can flash a toast.
export function importCartFromUrl(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(location.search)
  const raw = params.get('share-cart')
  if (!raw) return false
  const incoming: CartRecord = {}
  for (const pair of raw.split(',')) {
    const [idStr, qStr] = pair.split(':')
    const id = Number(idStr)
    const q = Math.min(Math.max(Number(qStr) || 1, 1), 99)
    if (Number.isInteger(id) && id > 0) incoming[String(id)] = q
  }
  if (Object.keys(incoming).length === 0) return false
  const merged = { ...readCart() }
  for (const [id, q] of Object.entries(incoming)) {
    merged[id] = (merged[id] ?? 0) + q
  }
  writeCart(merged)
  // Strip the share param so a refresh doesn't double-import.
  params.delete('share-cart')
  const qs = params.toString()
  const cleanUrl = location.pathname + (qs ? `?${qs}` : '') + location.hash
  window.history.replaceState(null, '', cleanUrl)
  return true
}
