// Multi-thread chat: lets a customer have several concurrent conversations
// and close them when resolved. Each thread belongs to a single email; the
// admin can close/reopen any.
//
//   GET  /api/chat-threads?my=<email>            list user's threads
//   GET  /api/chat-threads?email=<email>         admin: list customer's threads
//   POST /api/chat-threads { email, title }      create a new open thread
//   PATCH /api/chat-threads { id, status, email } close/reopen (own only)
//   Admin PATCH same — can act on any thread.
//
// Auth model is the same MVP as /api/messages — see that file's header.

import { createClient } from '@supabase/supabase-js'
import { isAdminAuthorized } from './_lib/auth.js'
import { isTableMissing } from './_lib/db.js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

const RL_WINDOW_MS = 60_000
const RL_MAX = 60
const rl = new Map()
function getIp(req) {
  const fwd = req.headers['x-forwarded-for']
  return (typeof fwd === 'string' ? fwd.split(',')[0] : fwd?.[0])?.trim() ?? 'unknown'
}
function rateLimited(ip) {
  const now = Date.now()
  const entry = rl.get(ip)
  if (!entry || now > entry.resetAt) {
    rl.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RL_MAX
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const STATUSES = ['open', 'closed']

const CTRL_PRESERVE_NL = new RegExp('[\\u0000-\\u0009\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g')
function s(v, max) {
  if (typeof v !== 'string') return ''
  return v.replace(CTRL_PRESERVE_NL, '').trim().slice(0, max)
}

export default async function handler(req, res) {
  let supabase
  try { supabase = getSupabase() } catch { return res.status(500).json({ error: 'database not configured' }) }

  const ip = getIp(req)

  // ── GET ── threads list (user or admin)
  if (req.method === 'GET') {
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests' })
    const isAdmin = isAdminAuthorized(req)
    const email = String(req.query.my ?? req.query.email ?? '').trim().toLowerCase()
    if (!isAdmin && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' })

    let q = supabase
      .from('chat_threads')
      .select('id, user_email, title, status, created_at, last_message_at')
      .order('last_message_at', { ascending: false })
      .limit(200)
    if (email) q = q.eq('user_email', email)

    const { data, error } = await q
    if (error) {
      if (isTableMissing(error)) return res.status(200).json([])
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json(data ?? [])
  }

  // ── POST ── create new thread
  if (req.method === 'POST') {
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests' })
    const body = req.body ?? {}
    const email = String(body.email ?? '').trim().toLowerCase()
    const title = s(body.title, 120) || 'новый чат'
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' })

    const { data, error } = await supabase
      .from('chat_threads')
      .insert([{ user_email: email, title, status: 'open' }])
      .select()
      .single()
    if (error) {
      if (isTableMissing(error)) return res.status(503).json({ error: 'table_not_found' })
      return res.status(500).json({ error: error.message })
    }
    return res.status(201).json(data)
  }

  // ── PATCH ── update status (close/reopen). Customer can only act on threads
  // matching their email; admin can act on anything.
  if (req.method === 'PATCH') {
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests' })
    const isAdmin = isAdminAuthorized(req)
    const body = req.body ?? {}
    const id = Number(body.id)
    const status = String(body.status ?? '')
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' })
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' })
    if (!isAdmin && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' })

    let q = supabase.from('chat_threads').update({ status }).eq('id', id)
    if (!isAdmin) q = q.eq('user_email', email)
    const { data, error } = await q.select().single()
    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'thread not found' })
    return res.status(200).json(data)
  }

  return res.status(405).json({ error: 'method not allowed' })
}
