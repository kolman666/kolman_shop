/** Append-only admin activity log (best-effort — never blocks the main request).
 *
 * Each entry can carry a `changes` array — list of `{ field, before, after }`
 * deltas — that gets merged into `meta.changes` and also rendered into the
 * `summary` field as a human-readable diff like:
 *   "цена: 1200 → 1490; quantity: 5 → 3"
 *
 * The diff helpers below let callers compare the previous record snapshot
 * with the next one and only log fields that actually changed.
 */

export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  const raw = (typeof fwd === 'string' ? fwd.split(',')[0] : fwd?.[0])?.trim()
  return raw || 'unknown'
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('http').IncomingMessage} req
 * @param {{
 *   action: string,
 *   entity?: string,
 *   entity_id?: string,
 *   summary?: string,
 *   meta?: Record<string, unknown>,
 *   changes?: Array<{ field: string, before: unknown, after: unknown }>,
 * }} entry
 */
export async function writeAuditLog(supabase, req, entry) {
  if (!supabase || !entry?.action) return
  try {
    const meta = entry.meta && typeof entry.meta === 'object' && !Array.isArray(entry.meta) ? { ...entry.meta } : {}
    if (Array.isArray(entry.changes) && entry.changes.length > 0) {
      meta.changes = entry.changes.slice(0, 40).map((c) => ({
        field: String(c.field ?? '').slice(0, 80),
        before: clampValue(c.before),
        after: clampValue(c.after),
      }))
    }
    // Auto-derive a human summary from `changes` if the caller didn't pass one.
    const summary = entry.summary
      ? String(entry.summary).slice(0, 500)
      : Array.isArray(meta.changes) && meta.changes.length > 0
        ? meta.changes
            .map((c) => `${c.field}: ${describe(c.before)} → ${describe(c.after)}`)
            .join('; ')
            .slice(0, 500)
        : ''

    const { error } = await supabase.from('admin_audit_log').insert({
      action: String(entry.action).slice(0, 64),
      entity: entry.entity ? String(entry.entity).slice(0, 64) : null,
      entity_id: entry.entity_id != null ? String(entry.entity_id).slice(0, 128) : null,
      summary,
      meta,
      ip: getClientIp(req).slice(0, 64),
    })
    if (error) {
      console.warn('[audit-log] insert failed:', error.message)
    }
  } catch (err) {
    console.warn('[audit-log] insert error:', err instanceof Error ? err.message : err)
  }
}

/**
 * Build `{ field, before, after }` entries for everything that changed
 * between two record snapshots. `fields` whitelists keys; `aliases` remaps
 * raw column names to user-facing labels ("price" → "цена").
 *
 * @param {Record<string, unknown> | null | undefined} before
 * @param {Record<string, unknown> | null | undefined} after
 * @param {{ fields?: string[], aliases?: Record<string, string>, skipUnchanged?: boolean }} [opts]
 */
export function diffRecords(before, after, opts = {}) {
  const fields = Array.isArray(opts.fields) ? opts.fields : null
  const aliases = opts.aliases && typeof opts.aliases === 'object' ? opts.aliases : {}
  const skipUnchanged = opts.skipUnchanged !== false
  const changes = []
  const beforeObj = (before && typeof before === 'object') ? before : {}
  const afterObj = (after && typeof after === 'object') ? after : {}
  const keys = fields ?? Array.from(new Set([...Object.keys(beforeObj), ...Object.keys(afterObj)]))
  for (const k of keys) {
    const a = beforeObj[k]
    const b = afterObj[k]
    if (skipUnchanged && deepEqual(a, b)) continue
    changes.push({ field: aliases[k] ?? k, before: a, after: b })
  }
  return changes
}

// ── helpers ───────────────────────────────────────────────────────────────

function deepEqual(a, b) {
  if (a === b) return true
  if (a == null || b == null) return a == null && b == null
  if (typeof a !== typeof b) return false
  if (typeof a !== 'object') return false
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

function clampValue(v, depth = 0) {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v.length > 200 ? `${v.slice(0, 200)}…` : v
  if (typeof v === 'number' || typeof v === 'boolean') return v
  // Recursion bomb / circular-ref guard: bail out at depth 5 with a marker
  // rather than stringifying — JSON.stringify on a 10k-deep object would
  // either crash or wedge the request.
  if (depth >= 5) return '{…}'
  if (Array.isArray(v)) {
    if (v.length > 50) return `[${v.length} items]`
    return v.slice(0, 20).map((x) => clampValue(x, depth + 1))
  }
  if (typeof v === 'object') {
    const out = {}
    let n = 0
    for (const [k, val] of Object.entries(v)) {
      if (n++ >= 30) { out['…'] = '…'; break }
      // Strip secrets / password material defensively.
      if (/password|secret|token|hash|salt/i.test(k)) {
        out[k] = '[redacted]'
        continue
      }
      out[k] = clampValue(val, depth + 1)
    }
    try {
      const s = JSON.stringify(out)
      return s.length > 400 ? `${s.slice(0, 400)}…` : out
    } catch { return '{…}' }
  }
  return String(v).slice(0, 200)
}

function describe(v) {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'string') return v.length > 60 ? `«${v.slice(0, 60)}…»` : `«${v}»`
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'да' : 'нет'
  if (Array.isArray(v)) return `[${v.length}]`
  return '{…}'
}
