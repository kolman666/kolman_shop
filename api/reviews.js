// Product reviews — stored in Supabase so they show up on every device the
// customer is signed into, and so other shoppers see them too. Photos are
// inline data URLs (JSONB array); the client resizes/JPEG-encodes each photo
// to ~800px before sending, keeping individual rows small.
//
//   GET    /api/reviews?product=<id>     all reviews for one product
//   GET    /api/reviews?my=<email>       reviews authored by a user
//   POST   /api/reviews { product_id, email, rating, text, photos? }
//   DELETE /api/reviews { id, email }    delete own review
//
// Auth: same MVP as orders / inquiries — the email is taken at face value
// (we trust it because it came from the localStorage-stored session token).
// Production-grade auth wraps this with a real server session later.

import { createClient } from '@supabase/supabase-js'
import { isTableMissing } from './_lib/db.js'
import { requestOwnsEmail } from './_lib/auth-users.js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

const RL_WINDOW_MS = 60_000
const RL_MAX = 30
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

// Strip ASCII control characters but keep \n / \r so paragraph breaks survive.
const CTRL_PRESERVE_NL = new RegExp('[\\u0000-\\u0009\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g')
function s(value, max) {
  if (typeof value !== 'string') return ''
  return value.replace(CTRL_PRESERVE_NL, '').trim().slice(0, max)
}

// Photos: array of http(s) URLs or data:image/* URLs. Cap at 6 photos, each
// up to ~1.5MB string (≈1MB binary after base64). The client resizes to
// 800px before upload so normal usage produces far smaller strings.
const MAX_PHOTOS = 6
const MAX_PHOTO_LEN = 1_500_000

function sanitizePhotos(input) {
  if (!Array.isArray(input)) return []
  const out = []
  for (const raw of input.slice(0, MAX_PHOTOS)) {
    if (typeof raw !== 'string') continue
    const v = raw.trim()
    if (!v || v.length > MAX_PHOTO_LEN) continue
    if (!/^(https?:\/\/|data:image\/)/i.test(v)) continue
    out.push(v)
  }
  return out
}

export default async function handler(req, res) {
  let supabase
  try { supabase = getSupabase() } catch { return res.status(500).json({ error: 'database not configured' }) }

  const ip = getIp(req)

  // ── GET ?product=<id> — public list for a product ──
  if (req.method === 'GET' && req.query.product) {
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests' })
    const productId = Number(req.query.product)
    if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid product' })
    const { data, error } = await supabase
      .from('reviews')
      .select('id, product_id, author_email, author_name, rating, text, photos, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      if (isTableMissing(error)) return res.status(200).json([])
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json(data ?? [])
  }

  // ── GET ?my=<email> — current user's own reviews ──
  if (req.method === 'GET' && req.query.my) {
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests' })
    const email = String(req.query.my).trim().toLowerCase()
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' })
    if (!(await requestOwnsEmail(req, supabase, email))) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const { data, error } = await supabase
      .from('reviews')
      .select('id, product_id, author_email, author_name, rating, text, photos, created_at')
      .eq('author_email', email)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) {
      if (isTableMissing(error)) return res.status(200).json([])
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json(data ?? [])
  }

  // ── POST — create a review ──
  if (req.method === 'POST') {
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests' })
    const body = req.body ?? {}
    const productId = Number(body.product_id)
    const email = String(body.email ?? '').trim().toLowerCase()
    const rating = Number(body.rating)
    const text = s(body.text, 4000)
    const authorName = s(body.author_name, 120)
    if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid product' })
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' })
    // Anyone who knew a victim's email could previously post fake reviews
    // *under their name*. Bearer token must match.
    if (!(await requestOwnsEmail(req, supabase, email))) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: 'invalid rating' })
    if (text.length < 3) return res.status(400).json({ error: 'text too short' })
    const photos = sanitizePhotos(body.photos)

    const { data, error } = await supabase
      .from('reviews')
      .insert([{
        product_id: productId,
        author_email: email,
        author_name: authorName || email.split('@')[0],
        rating,
        text,
        photos,
      }])
      .select()
      .single()
    if (error) {
      if (isTableMissing(error)) return res.status(503).json({ error: 'table_not_found' })
      return res.status(500).json({ error: error.message })
    }
    return res.status(201).json(data)
  }

  // ── DELETE — author can delete their own review ──
  if (req.method === 'DELETE') {
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests' })
    const body = req.body ?? {}
    const id = Number(body.id)
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'invalid id' })
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'invalid email' })
    if (!(await requestOwnsEmail(req, supabase, email))) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', id)
      .eq('author_email', email)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
