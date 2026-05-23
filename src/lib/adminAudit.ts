/** Client helper for the admin audit log (UI actions + mirrors of server events). */

export type AuditLogRow = {
  id: number
  action: string
  entity: string | null
  entity_id: string | null
  summary: string
  meta: Record<string, unknown>
  ip: string
  created_at: string
}

function adminHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Secret': sessionStorage.getItem('admin_secret') ?? '',
  }
}

/** Fire-and-forget — never throw to the caller. */
export function logAdminAction(entry: {
  action: string
  entity?: string
  entity_id?: string | number
  summary: string
  meta?: Record<string, unknown>
}): void {
  void fetch('/api/audit-log', {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({
      ...entry,
      entity_id: entry.entity_id != null ? String(entry.entity_id) : undefined,
    }),
  }).catch(() => { /* ignore */ })
}

export async function fetchAuditLog(opts?: {
  limit?: number
  offset?: number
  q?: string
}): Promise<{ items: AuditLogRow[]; total: number; needsMigration?: boolean }> {
  const params = new URLSearchParams()
  if (opts?.limit) params.set('limit', String(opts.limit))
  if (opts?.offset) params.set('offset', String(opts.offset))
  if (opts?.q?.trim()) params.set('q', opts.q.trim())
  const r = await fetch(`/api/audit-log?${params.toString()}`, { headers: adminHeaders() })
  if (!r.ok) throw new Error(`${r.status}`)
  return r.json() as Promise<{ items: AuditLogRow[]; total: number; needsMigration?: boolean }>
}
