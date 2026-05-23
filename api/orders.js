import { createClient } from '@supabase/supabase-js'
import { isAdminAuthorized } from './_lib/auth.js'
import { isTableMissing } from './_lib/db.js'
import { requestOwnsEmail } from './_lib/auth-users.js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

function isAuthorized(req) {
  return isAdminAuthorized(req)
}

// Naive in-memory rate limit for public POST
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

const ALLOWED_STATUSES = ['new', 'in_progress', 'done', 'cancelled']

function s(value, max = 500) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)
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

  // POST — public (place an order)
  if (req.method === 'POST') {
    const ip = getIp(req)
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests' })

    const body = req.body ?? {}
    const items = Array.isArray(body.items) ? body.items.slice(0, 100) : []
    if (items.length === 0) return res.status(400).json({ error: 'cart is empty' })

    // Normalize items: only the safe fields go into DB
    const safeItems = []
    for (const it of items) {
      if (!it || typeof it !== 'object') continue
      safeItems.push({
        id: typeof it.id === 'number' ? it.id : null,
        title: s(it.title, 200),
        price: typeof it.price === 'number' && Number.isFinite(it.price) ? it.price : 0,
        quantity: typeof it.quantity === 'number' && Number.isInteger(it.quantity) && it.quantity > 0 ? it.quantity : 1,
      })
    }
    // Always derive total server-side from the validated items. The client's
    // `body.total` is intentionally ignored — otherwise an attacker could
    // submit a $100 cart with `total: 1` and the DB would store the cheap
    // value. Telegram already rebuilds the message from server state below.
    const total = safeItems.reduce((acc, it) => acc + it.price * it.quantity, 0)

    const name = s(body.name, 200)
    const contact = s(body.contact, 200)
    if (!contact) return res.status(400).json({ error: 'contact is required' })
    const delivery = s(body.delivery, 200)
    const comment = s(body.comment, 1000)
    // Optional: when the buyer is logged in, the client sends their account
    // email so we can later show orders in their profile (`/api/orders?my=<email>`).
    // Validated as a normal email, stored in the dedicated `customer_email` column.
    const userEmail = s(body.user_email, 200).toLowerCase()
    const emailLooksValid = userEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)

    const insertRow = {
      status: 'new',
      customer_name: name,
      customer_contact: contact,
      delivery,
      comment,
      total,
      items: safeItems,
      ...(emailLooksValid ? { customer_email: userEmail } : {}),
    }

    let { data, error } = await supabase
      .from('orders')
      .insert([insertRow])
      .select()
      .single()

    // If the customer_email column doesn't exist yet (pre-migration), retry
    // without it so existing deployments keep working.
    if (error && emailLooksValid && /customer_email/i.test(error.message)) {
      const fallback = { ...insertRow }
      delete fallback.customer_email
      const retry = await supabase.from('orders').insert([fallback]).select().single()
      data = retry.data
      error = retry.error
    }

    if (error) {
      if (isTableMissing(error)) return res.status(503).json({ error: 'table_not_found', detail: error.message })
      return res.status(500).json({ error: 'failed to save order', detail: error.message })
    }

    // Always rebuild the Telegram payload server-side — never trust client HTML.
    const lines = [
      `🛒 <b>новый заказ #${data.id}</b>`,
      '',
      '📦 <b>состав:</b>',
      ...safeItems.map((it) => `• ${escapeHtml(it.title)} × ${it.quantity} — ${(it.price * it.quantity).toLocaleString('ru-RU')} ₽`),
      '',
      `💰 <b>итого:</b> ${total.toLocaleString('ru-RU')} ₽`,
      `👤 <b>имя:</b> ${escapeHtml(name) || '—'}`,
      `📞 <b>контакт:</b> ${escapeHtml(contact)}`,
      `🚚 <b>доставка:</b> ${escapeHtml(delivery) || '—'}`,
      `💬 <b>комментарий:</b> ${escapeHtml(comment) || '—'}`,
    ]
    const tg = await notifyTelegram(lines.join('\n'))
    return res.status(201).json({ id: data.id, telegram: tg })
  }

  // ── "My orders" — public endpoint guarded by rate limit ────────────────
  //
  // Returns only orders where the stored `customer_email` matches the email
  // passed by the client. This is NOT strongly authenticated: anyone who
  // knows another customer's email can enumerate their orders. Acceptable
  // for an MVP storefront with localStorage-only client auth; before going
  // to production behind a real domain you should:
  //   1. Replace this with a server session (e.g. Supabase Auth) and verify
  //      that the requesting user owns the email.
  //   2. Remove this branch.
  if (req.method === 'GET' && typeof req.query.my === 'string' && req.query.my.length > 0) {
    const ip = getIp(req)
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests' })
    const email = String(req.query.my).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) {
      return res.status(400).json({ error: 'invalid email' })
    }
    // Bearer token must match the email — was previously an open enumeration:
    // anyone passing a known email could list that user's full order history.
    if (!(await requestOwnsEmail(req, supabase, email))) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    let { data, error } = await supabase
      .from('orders')
      .select('id, status, total, items, delivery, comment, created_at, tracking_number, tracking_carrier')
      .eq('customer_email', email)
      .order('created_at', { ascending: false })
      .limit(50)
    // Pre-migration deployments may lack tracking columns OR customer_email
    // — gracefully fall back so existing data still loads.
    if (error && /tracking_(number|carrier)/i.test(error.message)) {
      const retry = await supabase
        .from('orders')
        .select('id, status, total, items, delivery, comment, created_at')
        .eq('customer_email', email)
        .order('created_at', { ascending: false })
        .limit(50)
      data = retry.data
      error = retry.error
    }
    if (error) {
      if (isTableMissing(error) || /customer_email/i.test(error.message)) return res.status(200).json([])
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json(data ?? [])
  }

  // ── Admin dashboard stats ─────────────────────────────────────────────
  // Aggregated counters for the admin home tab. Returns revenue + order
  // counts for today / 7d / 30d, status breakdown, and top-N products
  // (by quantity sold over the last 30d). All computed server-side from
  // the orders table so the client doesn't need to fetch the whole history.
  if (req.method === 'GET' && req.query.stats === '1') {
    if (!isAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })
    const now = Date.now()
    const day = 86_400_000
    const since30 = new Date(now - 30 * day).toISOString()
    const since7 = new Date(now - 7 * day).toISOString()
    const sinceToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    const { data: rows, error } = await supabase
      .from('orders')
      .select('id, status, total, items, created_at')
      .gte('created_at', since30)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) {
      if (isTableMissing(error)) {
        return res.status(200).json({
          revenue: { today: 0, week: 0, month: 0 },
          counts: { today: 0, week: 0, month: 0, new: 0, in_progress: 0, done: 0, cancelled: 0 },
          top: [],
        })
      }
      return res.status(500).json({ error: error.message })
    }
    const revenue = { today: 0, week: 0, month: 0 }
    const counts = { today: 0, week: 0, month: 0, new: 0, in_progress: 0, done: 0, cancelled: 0 }
    const productAgg = new Map()
    for (const r of rows ?? []) {
      const total = typeof r.total === 'number' ? r.total : 0
      const created = r.created_at
      counts.month++
      counts[r.status] = (counts[r.status] ?? 0) + 1
      // Cancelled orders don't contribute to revenue.
      if (r.status !== 'cancelled') revenue.month += total
      if (created >= since7) {
        counts.week++
        if (r.status !== 'cancelled') revenue.week += total
      }
      if (created >= sinceToday) {
        counts.today++
        if (r.status !== 'cancelled') revenue.today += total
      }
      // Top products by units sold (excluding cancelled).
      if (r.status !== 'cancelled' && Array.isArray(r.items)) {
        for (const it of r.items) {
          if (!it || typeof it.title !== 'string') continue
          const key = it.title
          const prev = productAgg.get(key) ?? { title: key, qty: 0, revenue: 0 }
          prev.qty += Number(it.quantity) || 0
          prev.revenue += (Number(it.price) || 0) * (Number(it.quantity) || 0)
          productAgg.set(key, prev)
        }
      }
    }
    const top = Array.from(productAgg.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
    return res.status(200).json({ revenue, counts, top })
  }

  // From here on — admin only
  if (!isAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })

  // GET — list with filters
  if (req.method === 'GET') {
    const status = typeof req.query.status === 'string' ? req.query.status : ''
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200)
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(limit)
    if (status && ALLOWED_STATUSES.includes(status)) q = q.eq('status', status)
    const { data, error } = await q
    if (error) {
      if (isTableMissing(error)) return res.status(503).json({ error: 'table_not_found' })
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json(data ?? [])
  }

  // PATCH — update status and/or tracking info
  if (req.method === 'PATCH') {
    const body = req.body ?? {}
    const id = Number(body.id)
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' })
    const patch = {}
    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.includes(body.status)) return res.status(400).json({ error: 'invalid status' })
      patch.status = body.status
    }
    // Tracking number / carrier are optional. Sanitized to ASCII printable
    // so a buggy paste doesn't break the DB row. Carrier is a short slug.
    if (typeof body.tracking_number === 'string') {
      patch.tracking_number = s(body.tracking_number, 80)
    }
    if (typeof body.tracking_carrier === 'string') {
      const c = s(body.tracking_carrier, 24).toLowerCase()
      patch.tracking_carrier = c.replace(/[^a-z0-9_-]/g, '')
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'nothing to update' })
    }
    let { data, error } = await supabase
      .from('orders')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    // If tracking columns don't exist yet (pre-migration), retry without them.
    if (error && /tracking_(number|carrier)/i.test(error.message)) {
      const fallback = { ...patch }
      delete fallback.tracking_number
      delete fallback.tracking_carrier
      if (Object.keys(fallback).length === 0) {
        return res.status(503).json({ error: 'tracking_columns_missing' })
      }
      const retry = await supabase.from('orders').update(fallback).eq('id', id).select().single()
      data = retry.data
      error = retry.error
    }
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {}
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' })
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
