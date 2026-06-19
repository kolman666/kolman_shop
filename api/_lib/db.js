// Cross-endpoint helpers for Supabase error handling.

// True for every variant of "this table doesn't exist" Supabase / PostgREST
// will return: raw Postgres 42P01, missing relation, or the PostgREST schema
// cache miss (PGRST205) that fires for ~10 seconds after a fresh schema change.
export function isTableMissing(err) {
  if (!err) return false
  const msg = String(err.message ?? '')
  const code = String(err.code ?? '')
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('Could not find the table')
  )
}

// Sanitize a user-supplied search term before interpolating it into a
// PostgREST `.or(...)` filter string. The `.or()` mini-language uses `,` to
// separate conditions and `()` to group them, so an unescaped term could break
// out of the intended `ilike` and inject extra filter conditions. We also drop
// the `ilike` wildcards (`%`, `*`), quote and backslash — a plain substring
// search doesn't need them. Returns '' when nothing searchable remains.
export function sanitizeOrPattern(q) {
  return String(q ?? '').replace(/[,()"*\\%]/g, ' ').replace(/\s+/g, ' ').trim()
}
