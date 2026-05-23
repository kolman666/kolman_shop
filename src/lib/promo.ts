// Persistent promo-code state for the cart. Stored under
// `localStorage[kolman-cart-promo]` so the discount survives drawer close /
// page reload. Cleared on checkout-success or by the inline ✕ button.
//
// The server is the source of truth for validity + discount amount — this
// module just remembers what code the shopper typed and the last verified
// discount snapshot.

const KEY = 'kolman-cart-promo'
export const PROMO_EVENT = 'cart-promo:update'

export type PromoState = {
  code: string
  kind: 'percent' | 'fixed'
  value: number
  discount: number    // last server-verified discount for current cart
  min_total: number
  // The subtotal we used to compute `discount` — when the cart contents
  // change the discount may no longer apply, so we re-validate.
  basedOnSubtotal: number
  note?: string
}

export function getPromo(): PromoState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as PromoState
    if (!v || typeof v.code !== 'string') return null
    return v
  } catch { return null }
}

export function setPromo(p: PromoState | null) {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p))
    else localStorage.removeItem(KEY)
    window.dispatchEvent(new Event(PROMO_EVENT))
  } catch { /* ignore */ }
}

export function getPromoAdjustedTotal(subtotal: number): number {
  const p = getPromo()
  if (!p) return subtotal
  // If the cart total changed since we validated, recompute locally — server
  // still has the final say on placement.
  if (p.basedOnSubtotal === subtotal) return Math.max(0, subtotal - p.discount)
  if (p.kind === 'percent') {
    return Math.max(0, subtotal - Math.round(subtotal * p.value / 100))
  }
  return Math.max(0, subtotal - Math.min(subtotal, Math.round(p.value)))
}

export type PromoValidation =
  | { ok: true; promo: PromoState }
  | { ok: false; error: string }

export async function validatePromo(code: string, subtotal: number): Promise<PromoValidation> {
  const c = code.trim().toUpperCase()
  if (!/^[A-Z0-9_-]{2,32}$/.test(c)) return { ok: false, error: 'invalid_code' }
  const r = await fetch(`/api/orders?promo=${encodeURIComponent(c)}&total=${subtotal}`)
  if (!r.ok) {
    const body = await r.json().catch(() => ({}))
    return { ok: false, error: (body as { error?: string }).error ?? `${r.status}` }
  }
  const j = await r.json() as { code: string; kind: 'percent' | 'fixed'; value: number; discount: number; min_total: number; note?: string }
  return {
    ok: true,
    promo: {
      code: j.code,
      kind: j.kind,
      value: j.value,
      discount: j.discount,
      min_total: j.min_total,
      basedOnSubtotal: subtotal,
      note: j.note,
    },
  }
}
