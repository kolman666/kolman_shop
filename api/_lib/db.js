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
