import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

function isAuthorized(req) {
  const secret = req.headers['x-admin-secret']
  return secret && secret === process.env.ADMIN_SECRET
}

export default async function handler(req, res) {
  let supabase
  try {
    supabase = getSupabase()
  } catch {
    return res.status(500).json({ error: 'database not configured' })
  }

  // GET — public read, no auth needed
  if (req.method === 'GET') {
    const { key } = req.query
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'key query param required' })
    }
    const { data, error } = await supabase
      .from('site_content')
      .select('value, updated_at')
      .eq('key', key)
      .single()
    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ key, value: data?.value ?? null, updated_at: data?.updated_at ?? null })
  }

  // PUT — admin only
  if (req.method === 'PUT') {
    if (!isAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })

    const { key, value } = req.body ?? {}
    if (!key || typeof key !== 'string') return res.status(400).json({ error: 'key required' })
    if (value === undefined) return res.status(400).json({ error: 'value required' })

    const { error } = await supabase
      .from('site_content')
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
