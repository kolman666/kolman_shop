/**
 * Returns the input URL only if it's a safe http(s) URL or an internal path
 * starting with a single "/". Otherwise returns null.
 *
 * Use this for any URL that came from user-controlled storage (DB, localStorage)
 * before plugging it into href/src. Blocks javascript:, data:, vbscript: and
 * protocol-relative "//evil.com" payloads.
 */
export function safeHref(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v) return null
  if (v.length > 2048) return null
  if (v.startsWith('//')) return null
  if (v.startsWith('/')) return /[\s"'<>`]/.test(v) ? null : v
  try {
    const u = new URL(v)
    if (u.protocol === 'http:' || u.protocol === 'https:') return v
    return null
  } catch {
    return null
  }
}

/**
 * Returns a safe value to use inside CSS `url(...)`. Strips characters that
 * could close the url() and inject other declarations. Returns null if unsafe.
 */
export function safeBackgroundImage(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim()
  if (!v) return null
  if (v.length > 2048) return null
  // Reject anything that looks like CSS escape, parentheses, quotes, semicolons, newlines
  if (/[)("'<>;\n\r\\]/.test(v)) return null
  if (v.startsWith('//')) return null
  if (v.startsWith('/')) return v
  try {
    const u = new URL(v)
    if (u.protocol === 'http:' || u.protocol === 'https:') return v
    return null
  } catch {
    return null
  }
}
