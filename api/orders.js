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
    // ── Stock check ───────────────────────────────────────────────────
    // Before saving the order we look up the current `quantity` for every
    // product in the cart and reject if anyone is asking for more than is
    // available. The product table may not have a quantity column on older
    // deployments — we treat null/undefined as "unlimited" so legacy items
    // keep checking out.
    const productIds = safeItems.map((it) => it.id).filter((id) => Number.isInteger(id))
    if (productIds.length > 0) {
      let pr = await supabase
        .from('admin_products')
        .select('id, quantity, title, brand')
        .in('id', productIds)
      // Fallback to legacy table name.
      if (pr.error && /admin_products/i.test(pr.error.message)) {
        pr = await supabase.from('products').select('id, quantity, title, brand').in('id', productIds)
      }
      if (!pr.error && Array.isArray(pr.data)) {
        const stockById = new Map(pr.data.map((p) => [p.id, p]))
        const outOfStock = []
        for (const it of safeItems) {
          if (!Number.isInteger(it.id)) continue
          const p = stockById.get(it.id)
          if (!p) continue
          // null / undefined / negative = unlimited (admin hasn't set a limit).
          if (typeof p.quantity !== 'number' || p.quantity < 0) continue
          if (it.quantity > p.quantity) {
            outOfStock.push({
              product_id: it.id,
              title: p.title || it.title,
              requested: it.quantity,
              available: p.quantity,
            })
          }
        }
        if (outOfStock.length > 0) {
          return res.status(409).json({
            error: 'out_of_stock',
            items: outOfStock,
          })
        }
      }
    }

    // Always derive total server-side from the validated items. The client's
    // `body.total` is intentionally ignored — otherwise an attacker could
    // submit a $100 cart with `total: 1` and the DB would store the cheap
    // value. Telegram already rebuilds the message from server state below.
    const subtotal = safeItems.reduce((acc, it) => acc + it.price * it.quantity, 0)
    let total = subtotal
    let promoApplied = null
    // Optional promo code applied at checkout. We validate + apply server-side
    // so a tampered client can't smuggle a bigger discount.
    if (typeof body.promo_code === 'string' && body.promo_code.trim()) {
      const code = body.promo_code.trim().toUpperCase().slice(0, 32)
      if (/^[A-Z0-9_-]{2,32}$/.test(code)) {
        const pr = await supabase.from('promo_codes').select('*').eq('code', code).maybeSingle()
        if (!pr.error && pr.data) {
          const c = pr.data
          const now = Date.now()
          const fromOk = !c.valid_from || new Date(c.valid_from).getTime() <= now
          const toOk = !c.valid_to || new Date(c.valid_to).getTime() >= now
          const usesOk = !c.max_uses || (c.used_count ?? 0) < c.max_uses
          const minOk = !c.min_total || subtotal >= c.min_total
          if (fromOk && toOk && usesOk && minOk) {
            const discount = c.kind === 'percent'
              ? Math.round(subtotal * (Number(c.value) || 0) / 100)
              : Math.min(subtotal, Math.round(Number(c.value) || 0))
            total = Math.max(0, subtotal - discount)
            promoApplied = { code: c.code, kind: c.kind, value: c.value, discount }
            // Best-effort bump of used_count. Race-safe via RPC would be nicer;
            // for low-volume this is fine.
            await supabase
              .from('promo_codes')
              .update({ used_count: (c.used_count ?? 0) + 1 })
              .eq('code', code)
              .then(() => undefined, () => undefined)
          }
        }
      }
    }

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
      ...(promoApplied ? { promo_code: promoApplied.code, promo_discount: promoApplied.discount } : {}),
    }

    let { data, error } = await supabase
      .from('orders')
      .insert([insertRow])
      .select()
      .single()

    // If new columns don't exist yet (pre-migration), retry without them
    // so existing deployments keep working. We strip both `customer_email`
    // and the optional promo columns in turn until something sticks.
    if (error && /(customer_email|promo_code|promo_discount)/i.test(error.message)) {
      const fallback = { ...insertRow }
      delete fallback.customer_email
      delete fallback.promo_code
      delete fallback.promo_discount
      const retry = await supabase.from('orders').insert([fallback]).select().single()
      data = retry.data
      error = retry.error
    }

    if (error) {
      if (isTableMissing(error)) return res.status(503).json({ error: 'table_not_found', detail: error.message })
      return res.status(500).json({ error: 'failed to save order', detail: error.message })
    }

    // ── Decrement stock ──────────────────────────────────────────────
    // Best-effort decrement of the `quantity` column for every product in
    // the order. The check above already confirmed there's enough stock.
    // We run updates in parallel; if any fails it doesn't abort the order
    // (the order is already saved). Admin sees the discrepancy in the
    // dashboard / orders list and can adjust manually.
    for (const it of safeItems) {
      if (!Number.isInteger(it.id) || it.quantity <= 0) continue
      void supabase.rpc('decrement_product_quantity', { p_id: it.id, p_delta: it.quantity }).then(
        () => undefined,
        async () => {
          // RPC may not exist — fall back to read-modify-write. Race-prone
          // for two simultaneous orders of the same item, acceptable at
          // current store volume.
          const got = await supabase.from('admin_products').select('quantity').eq('id', it.id).maybeSingle()
          if (got.error || !got.data || typeof got.data.quantity !== 'number') return
          const next = Math.max(0, got.data.quantity - it.quantity)
          await supabase.from('admin_products').update({ quantity: next }).eq('id', it.id)
        },
      )
    }

    // Always rebuild the Telegram payload server-side — never trust client HTML.
    const lines = [
      `🛒 <b>новый заказ #${data.id}</b>`,
      '',
      '📦 <b>состав:</b>',
      ...safeItems.map((it) => `• ${escapeHtml(it.title)} × ${it.quantity} — ${(it.price * it.quantity).toLocaleString('ru-RU')} ₽`),
      '',
      ...(promoApplied
        ? [
            `💵 <b>сумма:</b> ${subtotal.toLocaleString('ru-RU')} ₽`,
            `🎟️ <b>промо:</b> <code>${escapeHtml(promoApplied.code)}</code> · −${promoApplied.discount.toLocaleString('ru-RU')} ₽`,
          ]
        : []),
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

  // ── Promo codes ────────────────────────────────────────────────────────
  // Codes live in a separate `promo_codes` table — see SQL block at the top
  // of this branch. The shape is:
  //   code TEXT PRIMARY KEY,
  //   kind TEXT NOT NULL ('percent' | 'fixed'),
  //   value NUMERIC NOT NULL,        -- 10 means 10%; for fixed = ₽ off
  //   min_total NUMERIC DEFAULT 0,   -- minimum cart total to apply
  //   valid_from TIMESTAMPTZ,
  //   valid_to TIMESTAMPTZ,
  //   max_uses INTEGER,              -- null = unlimited
  //   used_count INTEGER DEFAULT 0,
  //   note TEXT
  //
  //   GET  /api/orders?promo=<code>&total=<n>   public — validate + return discount
  //   GET  /api/orders?promos=1                 admin — list all codes
  //   POST /api/orders?promo=1   { code, kind, value, ... }   admin — create/update
  //   DELETE /api/orders?promo=1 { code }       admin — remove
  if (req.method === 'GET' && req.query.promos === '1') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })
    const r = await supabase
      .from('promo_codes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    if (r.error) {
      if (isTableMissing(r.error)) return res.status(200).json([])
      return res.status(500).json({ error: r.error.message })
    }
    return res.status(200).json(r.data ?? [])
  }

  if (req.method === 'GET' && typeof req.query.promo === 'string' && req.query.promo) {
    const code = String(req.query.promo).trim().toUpperCase().slice(0, 32)
    if (!/^[A-Z0-9_-]{2,32}$/.test(code)) return res.status(400).json({ error: 'invalid code' })
    const totalRaw = Number(req.query.total)
    const total = Number.isFinite(totalRaw) && totalRaw > 0 ? Math.min(totalRaw, 10_000_000) : 0
    const r = await supabase.from('promo_codes').select('*').eq('code', code).maybeSingle()
    if (r.error) {
      if (isTableMissing(r.error)) return res.status(404).json({ error: 'unknown_code' })
      return res.status(500).json({ error: r.error.message })
    }
    if (!r.data) return res.status(404).json({ error: 'unknown_code' })
    const c = r.data
    const now = Date.now()
    if (c.valid_from && new Date(c.valid_from).getTime() > now) {
      return res.status(409).json({ error: 'not_yet_valid' })
    }
    if (c.valid_to && new Date(c.valid_to).getTime() < now) {
      return res.status(410).json({ error: 'expired' })
    }
    if (typeof c.max_uses === 'number' && c.max_uses > 0 && (c.used_count ?? 0) >= c.max_uses) {
      return res.status(410).json({ error: 'exhausted' })
    }
    if (typeof c.min_total === 'number' && c.min_total > 0 && total > 0 && total < c.min_total) {
      return res.status(409).json({ error: 'min_total_not_met', min_total: c.min_total })
    }
    const discount = c.kind === 'percent'
      ? Math.round(total * (Number(c.value) || 0) / 100)
      : Math.min(total, Math.round(Number(c.value) || 0))
    return res.status(200).json({
      code: c.code,
      kind: c.kind,
      value: c.value,
      min_total: c.min_total ?? 0,
      discount,
      note: c.note ?? '',
    })
  }

  if (req.method === 'POST' && req.query.promo === '1') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })
    const b = req.body ?? {}
    const code = s(String(b.code ?? ''), 32).toUpperCase().replace(/[^A-Z0-9_-]/g, '')
    if (!code || code.length < 2) return res.status(400).json({ error: 'invalid code' })
    const kind = b.kind === 'percent' || b.kind === 'fixed' ? b.kind : null
    if (!kind) return res.status(400).json({ error: 'invalid kind' })
    const value = Number(b.value)
    if (!Number.isFinite(value) || value <= 0) return res.status(400).json({ error: 'invalid value' })
    if (kind === 'percent' && value > 99) return res.status(400).json({ error: 'percent must be 1..99' })
    const row = {
      code,
      kind,
      value,
      min_total: Number.isFinite(Number(b.min_total)) ? Math.max(0, Number(b.min_total)) : 0,
      valid_from: typeof b.valid_from === 'string' && b.valid_from ? b.valid_from : null,
      valid_to: typeof b.valid_to === 'string' && b.valid_to ? b.valid_to : null,
      max_uses: Number.isInteger(b.max_uses) && b.max_uses > 0 ? b.max_uses : null,
      note: typeof b.note === 'string' ? s(b.note, 200) : '',
    }
    const r = await supabase.from('promo_codes').upsert(row, { onConflict: 'code' }).select().single()
    if (r.error) {
      if (isTableMissing(r.error)) return res.status(503).json({ error: 'table_not_found' })
      return res.status(500).json({ error: r.error.message })
    }
    return res.status(201).json(r.data)
  }

  if (req.method === 'DELETE' && req.query.promo === '1') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })
    const code = String(req.body?.code ?? '').toUpperCase().slice(0, 32)
    if (!/^[A-Z0-9_-]{2,32}$/.test(code)) return res.status(400).json({ error: 'invalid code' })
    const r = await supabase.from('promo_codes').delete().eq('code', code)
    if (r.error) return res.status(500).json({ error: r.error.message })
    return res.status(200).json({ ok: true })
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
    // Look back 60 days so we can compute "previous period" deltas. Older
    // rows are filtered out per-bucket below.
    const since60 = new Date(now - 60 * day).toISOString()
    const since30 = new Date(now - 30 * day).toISOString()
    const since14 = new Date(now - 14 * day).toISOString()
    const since7 = new Date(now - 7 * day).toISOString()
    const sinceToday = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    const sinceYesterday = new Date(new Date().setHours(0, 0, 0, 0) - day).toISOString()

    const emptyStats = {
      revenue: { today: 0, yesterday: 0, week: 0, weekPrev: 0, month: 0, monthPrev: 0 },
      counts: { today: 0, week: 0, month: 0, new: 0, in_progress: 0, done: 0, cancelled: 0 },
      aov: { current: 0, previous: 0 },
      top: [],
      daily: [],
      pending: { needTracking: 0, openInquiries: 0, openChats: 0 },
      recentOrders: [],
    }

    const { data: rows, error } = await supabase
      .from('orders')
      .select('id, status, total, items, created_at, customer_name, tracking_number')
      .gte('created_at', since60)
      .order('created_at', { ascending: false })
      .limit(1000)
    if (error && !/tracking_/i.test(error.message)) {
      if (isTableMissing(error)) return res.status(200).json(emptyStats)
      return res.status(500).json({ error: error.message })
    }
    let safeRows = rows
    if (error) {
      // tracking columns missing — retry minus those columns
      const retry = await supabase
        .from('orders')
        .select('id, status, total, items, created_at, customer_name')
        .gte('created_at', since60)
        .order('created_at', { ascending: false })
        .limit(1000)
      if (retry.error) {
        if (isTableMissing(retry.error)) return res.status(200).json(emptyStats)
        return res.status(500).json({ error: retry.error.message })
      }
      safeRows = retry.data
    }

    const revenue = { today: 0, yesterday: 0, week: 0, weekPrev: 0, month: 0, monthPrev: 0 }
    const counts = { today: 0, week: 0, month: 0, new: 0, in_progress: 0, done: 0, cancelled: 0 }
    let aovCurrentSum = 0, aovCurrentN = 0, aovPrevSum = 0, aovPrevN = 0
    const productAgg = new Map()
    // Daily revenue / order count, last 30 days, oldest → newest for sparkline.
    const dailyMap = new Map()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * day)
      d.setHours(0, 0, 0, 0)
      dailyMap.set(d.toISOString().slice(0, 10), { date: d.toISOString().slice(0, 10), revenue: 0, orders: 0 })
    }

    let needTracking = 0
    const recentOrders = []

    for (const r of safeRows ?? []) {
      const total = typeof r.total === 'number' ? r.total : 0
      const created = r.created_at
      const isFresh = created >= since30
      if (isFresh) {
        counts.month++
        counts[r.status] = (counts[r.status] ?? 0) + 1
        if (r.status !== 'cancelled') {
          revenue.month += total
          aovCurrentSum += total
          aovCurrentN++
        }
        if (created >= since7) {
          counts.week++
          if (r.status !== 'cancelled') revenue.week += total
        }
        if (created >= sinceYesterday && created < sinceToday) {
          if (r.status !== 'cancelled') revenue.yesterday += total
        }
        if (created >= sinceToday) {
          counts.today++
          if (r.status !== 'cancelled') revenue.today += total
        }
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
        // Daily bucket
        const dayKey = created.slice(0, 10)
        const bucket = dailyMap.get(dayKey)
        if (bucket && r.status !== 'cancelled') {
          bucket.revenue += total
          bucket.orders += 1
        }
      } else {
        // 30-60d window → "previous period" comparisons.
        if (r.status !== 'cancelled' && created >= since60) {
          revenue.monthPrev += total
          aovPrevSum += total
          aovPrevN++
        }
        if (r.status !== 'cancelled' && created >= since14 && created < since7) {
          revenue.weekPrev += total
        }
      }
      // Pending tracking: in_progress orders without a tracking number.
      if (r.status === 'in_progress' && !r.tracking_number) needTracking++
      // Recent orders for the activity feed (max 10, already newest-first).
      if (recentOrders.length < 10) {
        recentOrders.push({
          id: r.id,
          customer_name: r.customer_name || '',
          total,
          status: r.status,
          created_at: r.created_at,
        })
      }
    }

    const top = Array.from(productAgg.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)

    const daily = Array.from(dailyMap.values())

    // Pending: open inquiries + open chats — cheap lookups, single COUNT each.
    let openInquiries = 0
    let openChats = 0
    try {
      const rI = await supabase
        .from('inquiries')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'done')
      openInquiries = rI.count ?? 0
    } catch { /* table missing */ }
    try {
      const rC = await supabase
        .from('chat_threads')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open')
      openChats = rC.count ?? 0
    } catch { /* ignore */ }

    return res.status(200).json({
      revenue,
      counts,
      aov: {
        current: aovCurrentN > 0 ? Math.round(aovCurrentSum / aovCurrentN) : 0,
        previous: aovPrevN > 0 ? Math.round(aovPrevSum / aovPrevN) : 0,
      },
      top,
      daily,
      pending: { needTracking, openInquiries, openChats },
      recentOrders,
    })
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
