import { createClient } from '@supabase/supabase-js'
import { isAdminAuthorized } from './_lib/auth.js'
import { isTableMissing, sanitizeOrPattern } from './_lib/db.js'
import { writeAuditLog } from './_lib/audit-log.js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

function s(value, max = 500) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)
}

export default async function handler(req, res) {
  if (!isAdminAuthorized(req)) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  let supabase
  try {
    supabase = getSupabase()
  } catch {
    return res.status(500).json({ error: 'database not configured' })
  }

  if (req.method === 'GET') {
    const limitRaw = Number(req.query.limit)
    const offsetRaw = Number(req.query.offset)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 80
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0
    const q = typeof req.query.q === 'string' ? s(req.query.q, 80) : ''

    let query = supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const term = sanitizeOrPattern(q)
    if (term) {
      query = query.or(`summary.ilike.%${term}%,action.ilike.%${term}%,entity.ilike.%${term}%,entity_id.ilike.%${term}%`)
    }

    const r = await query
    if (r.error) {
      if (isTableMissing(r.error)) return res.status(200).json({ items: [], total: 0, needsMigration: true })
      return res.status(500).json({ error: r.error.message })
    }
    return res.status(200).json({ items: r.data ?? [], total: r.count ?? 0 })
  }

  if (req.method === 'POST') {
    const b = req.body ?? {}
    const action = s(b.action, 64)
    if (!action) return res.status(400).json({ error: 'action required' })
    await writeAuditLog(supabase, req, {
      action,
      entity: b.entity ? s(String(b.entity), 64) : undefined,
      entity_id: b.entity_id != null ? s(String(b.entity_id), 128) : undefined,
      summary: s(b.summary ?? action, 500),
      meta: b.meta,
    })
    return res.status(201).json({ ok: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
