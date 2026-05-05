// Shared API auth helpers.
import { Buffer } from 'node:buffer'
import crypto from 'node:crypto'

/** Constant-time string comparison. Both inputs are coerced to strings. */
export function safeEqual(a, b) {
  const sa = typeof a === 'string' ? a : ''
  const sb = typeof b === 'string' ? b : ''
  // Pad to equal length to avoid leaking length via timing — timingSafeEqual requires equal length.
  const len = Math.max(sa.length, sb.length, 1)
  const ba = Buffer.alloc(len)
  const bb = Buffer.alloc(len)
  ba.write(sa)
  bb.write(sb)
  let equal = false
  try {
    equal = crypto.timingSafeEqual(ba, bb)
  } catch {
    equal = false
  }
  // Force length mismatch to count as inequal even after timing-safe pad.
  return equal && sa.length === sb.length
}

/**
 * Returns true if the request carries a valid `X-Admin-Secret` header.
 * Use this everywhere instead of bare `===`.
 */
export function isAdminAuthorized(req) {
  const secret = req.headers['x-admin-secret']
  const expected = process.env.ADMIN_SECRET
  if (!expected) return false
  if (typeof secret !== 'string') return false
  return safeEqual(secret, expected)
}

/** Validate a public-facing URL: only http/https schemes allowed. */
export function isSafeHttpUrl(url, { allowEmpty = true } = {}) {
  if (typeof url !== 'string') return false
  const trimmed = url.trim()
  if (!trimmed) return allowEmpty
  if (trimmed.length > 2048) return false
  let parsed
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:'
}

/** Validate a string used as a router path or external URL.
 *  Allowed: empty, "/<path>" (no protocol-relative // and no embedded scheme), or http(s) URL. */
export function isSafeLinkOrPath(value, { allowEmpty = true } = {}) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  if (!trimmed) return allowEmpty
  if (trimmed.length > 2048) return false
  if (trimmed.startsWith('/')) {
    // reject protocol-relative "//evil.com"
    if (trimmed.startsWith('//')) return false
    // disallow control chars / quotes that could break HTML attribute
    if (/[\s"'<>`]/.test(trimmed)) return false
    return true
  }
  return isSafeHttpUrl(trimmed, { allowEmpty: false })
}
