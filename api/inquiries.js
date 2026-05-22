import { createClient } from '@supabase/supabase-js'
import { isAdminAuthorized } from './_lib/auth.js'
import { requestOwnsEmail } from './_lib/auth-users.js'
import { isTableMissing } from './_lib/db.js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

function isAuthorized(req) {
  return isAdminAuthorized(req)
}

const RL_WINDOW_MS = 60_000
const RL_MAX = 6
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

const ALLOWED_CATEGORIES = ['order', 'product', 'choose', 'delivery', 'other']
const ALLOWED_STATUSES = ['new', 'in_progress', 'done']

const CATEGORY_LABELS = {
  order: 'проблема с заказом',
  product: 'вопрос о товаре',
  choose: 'помощь с выбором',
  delivery: 'доставка и оплата',
  other: 'другое',
}

function s(value, max = 500) {
  if (typeof value !== 'string') return ''
  return value.replace(/\r/g, '').trim().slice(0, max)
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function notifyTelegram(text) {
  const token = process.env.TG_BOT_TOKEN
  const chatId = process.env.TG_CHAT_ID
  if (!token || !chatId) return { ok: false, detail: 'telegram not configured' }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text.slice(0, 4000),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })
    if (!r.ok) {
      let detail = 'telegram api ' + r.status
      try {
        const j = await r.json()
        if (j && typeof j.description === 'string') detail = j.description
      } catch { /* ignore */ }
      return { ok: false, detail }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

export default async function handler(req, res) {
  let supabase
  try {
    supabase = getSupabase()
  } catch {
    return res.status(500).json({ error: 'database not configured' })
  }

  if (req.method === 'POST') {
    const ip = getIp(req)
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests' })

    const body = req.body ?? {}
    const category = ALLOWED_CATEGORIES.includes(body.category) ? body.category : 'other'
    const name = s(body.name, 200)
    const contact = s(body.contact, 200)
    const message = s(body.message, 4000)
    const userEmail = s(body.user_email, 200).toLowerCase()
    const emailLooksValid = userEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)

    if (!message) return res.status(400).json({ error: 'message is required' })

    const insertRow = {
      category,
      status: 'new',
      customer_name: name,
      customer_contact: contact,
      message,
      ...(emailLooksValid ? { customer_email: userEmail } : {}),
    }

    let { data, error } = await supabase
      .from('inquiries')
      .insert([insertRow])
      .select()
      .single()

    // Retry without customer_email when the column is missing (pre-migration).
    if (error && emailLooksValid && /customer_email/i.test(error.message)) {
      const fallback = { ...insertRow }
      delete fallback.customer_email
      const retry = await supabase.from('inquiries').insert([fallback]).select().single()
      data = retry.data
      error = retry.error
    }

    if (error) {
      if (isTableMissing(error)) return res.status(503).json({ error: 'table_not_found', detail: error.message })
      return res.status(500).json({ error: 'failed to save inquiry', detail: error.message })
    }

    // Always rebuild server-side — never trust client HTML.
    const tgText = [
      `📋 <b>новая заявка #${data.id}</b>`,
      `📌 <b>тип:</b> ${escapeHtml(CATEGORY_LABELS[category])}`,
      `👤 <b>имя:</b> ${escapeHtml(name) || '—'}`,
      `📞 <b>контакт:</b> ${escapeHtml(contact) || '—'}`,
      '',
      '💬 <b>вопрос:</b>',
      escapeHtml(message),
    ].join('\n')
    const tg = await notifyTelegram(tgText)
    return res.status(201).json({ id: data.id, telegram: tg })
  }

  // ── "My inquiries" — public endpoint guarded by rate limit ─────────────
  // Same caveat as /api/orders?my=…: returns rows where customer_email
  // matches. Rate-limited per IP. Replace with real session auth before
  // production.
  if (req.method === 'GET' && typeof req.query.my === 'string' && req.query.my.length > 0) {
    const ip = getIp(req)
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests' })
    const email = String(req.query.my).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      return res.status(400).json({ error: 'invalid email' })
    }
    // Require bearer-token ownership — otherwise anyone with the email could
    // read another user's inquiry history.
    if (!(await requestOwnsEmail(req, supabase, email))) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const { data, error } = await supabase
      .from('inquiries')
      .select('id, status, category, message, created_at')
      .eq('customer_email', email)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      if (isTableMissing(error) || /customer_email/i.test(error.message)) return res.status(200).json([])
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json(data ?? [])
  }

  if (!isAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })

  if (req.method === 'GET') {
    const category = typeof req.query.category === 'string' ? req.query.category : ''
    const status = typeof req.query.status === 'string' ? req.query.status : ''
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)
    let q = supabase.from('inquiries').select('*').order('created_at', { ascending: false }).limit(limit)
    if (category && ALLOWED_CATEGORIES.includes(category)) q = q.eq('category', category)
    if (status && ALLOWED_STATUSES.includes(status)) q = q.eq('status', status)
    const { data, error } = await q
    if (error) {
      if (isTableMissing(error)) return res.status(503).json({ error: 'table_not_found' })
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json(data ?? [])
  }

  if (req.method === 'PATCH') {
    const { id, status } = req.body ?? {}
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' })
    if (!ALLOWED_STATUSES.includes(status)) return res.status(400).json({ error: 'invalid status' })
    const { data, error } = await supabase
      .from('inquiries')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body ?? {}
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' })
    const { error } = await supabase.from('inquiries').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
