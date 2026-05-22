// Admin-only batch lookup of public user profiles by email. Used by the admin
// chat view to show "Иван Иванов <ivan@example.com>" instead of just the
// email address.
//
//   GET /api/users-lookup?emails=a@b.com,c@d.com   (admin secret required)
//
// Returns { [email]: { name, firstName, lastName, telegram, photo } } so the
// caller can render exactly what it needs.

import { createClient } from '@supabase/supabase-js'
import { isAdminAuthorized } from './_lib/auth.js'
import { isTableMissing } from './_lib/db.js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_EMAILS = 100

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' })
  if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })

  let supabase
  try { supabase = getSupabase() } catch { return res.status(500).json({ error: 'database not configured' }) }

  const raw = typeof req.query.emails === 'string' ? req.query.emails : ''
  const emails = Array.from(new Set(
    raw.split(',').map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)),
  )).slice(0, MAX_EMAILS)
  if (emails.length === 0) return res.status(200).json({})

  const { data, error } = await supabase
    .from('auth_users')
    .select('email, name, first_name, last_name, telegram, photo')
    .in('email', emails)
  if (error) {
    if (isTableMissing(error)) return res.status(200).json({})
    return res.status(500).json({ error: error.message })
  }

  const out = {}
  for (const row of data ?? []) {
    out[row.email] = {
      name: row.name || '',
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      telegram: row.telegram || '',
      photo: row.photo || '',
    }
  }
  return res.status(200).json(out)
}
