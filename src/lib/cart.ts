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
