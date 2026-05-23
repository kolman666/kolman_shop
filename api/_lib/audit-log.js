/** Append-only admin activity log (best-effort — never blocks the main request). */

export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  const raw = (typeof fwd === 'string' ? fwd.split(',')[0] : fwd?.[0])?.trim()
  return raw || 'unknown'
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('http').IncomingMessage} req
 * @param {{ action: string, entity?: string, entity_id?: string, summary?: string, meta?: Record<string, unknown> }} entry
 */
export async function writeAuditLog(supabase, req, entry) {
  if (!supabase || !entry?.action) return
  try {
    const { error } = await supabase.from('admin_audit_log').insert({
      action: String(entry.action).slice(0, 64),
      entity: entry.entity ? String(entry.entity).slice(0, 64) : null,
      entity_id: entry.entity_id != null ? String(entry.entity_id).slice(0, 128) : null,
      summary: String(entry.summary ?? '').slice(0, 500),
      meta: entry.meta && typeof entry.meta === 'object' && !Array.isArray(entry.meta) ? entry.meta : {},
      ip: getClientIp(req).slice(0, 64),
    })
    if (error) {
      // Table may not exist yet on older deployments.
      console.warn('[audit-log] insert failed:', error.message)
    }
  } catch (err) {
    console.warn('[audit-log] insert error:', err instanceof Error ? err.message : err)
  }
}
