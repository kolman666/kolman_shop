import { createClient } from '@supabase/supabase-js'
import { isAdminAuthorized } from './_lib/auth.js'
import { isTableMissing } from './_lib/db.js'
import { requestOwnsEmail } from './_lib/auth-users.js'
import { writeAuditLog, diffRecords } from './_lib/audit-log.js'

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
// Must match src/lib/supabaseProducts.ts — client cart keys use offset ids.
const SUPABASE_ID_OFFSET = 1_000_000

function toDbProductId(raw) {
  if (!Number.isInteger(raw) || raw <= 0) return null
  if (raw >= SUPABASE_ID_OFFSET) return raw - SUPABASE_ID_OFFSET
  return raw
}

function clientCartProductId(dbId, rawClientId) {
  if (Number.isInteger(rawClientId) && rawClientId >= SUPABASE_ID_OFFSET) return rawClientId
  if (Number.isInteger(dbId) && dbId > 0) return SUPABASE_ID_OFFSET + dbId
  return rawClientId ?? null
}

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

  // POST — public (place an order), except admin promo CRUD (?promo=1)
  if (req.method === 'POST') {
    if (req.query.promo === '1') {
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
      // Capture the existing row (if any) for a real diff in the audit log.
      const before = await supabase.from('promo_codes').select('*').eq('code', row.code).maybeSingle()
      const wasNew = !before.data
      const r = await supabase.from('promo_codes').upsert(row, { onConflict: 'code' }).select().single()
      if (r.error) {
        if (isTableMissing(r.error)) return res.status(503).json({ error: 'table_not_found' })
        return res.status(500).json({ error: r.error.message })
      }
      const PROMO_ALIASES = {
        kind: 'тип', value: 'значение', min_total: 'мин. сумма',
        valid_from: 'действует с', valid_to: 'действует до',
        max_uses: 'лимит использований', note: 'заметка',
      }
      const changes = wasNew
        ? Object.entries(row).map(([k, v]) => ({ field: PROMO_ALIASES[k] ?? k, before: null, after: v }))
        : diffRecords(before.data, r.data, {
            fields: ['kind', 'value', 'min_total', 'valid_from', 'valid_to', 'max_uses', 'note'],
            aliases: PROMO_ALIASES,
          })
      await writeAuditLog(supabase, req, {
        action: wasNew ? 'promo.create' : 'promo.update',
        entity: 'promo',
        entity_id: row.code,
        summary: wasNew
          ? `Создан промокод ${row.code}: ${row.kind === 'percent' ? `${row.value}%` : `${row.value} ₽`}`
          : `Промокод ${row.code} обновлён`,
        changes,
      })
      return res.status(201).json(r.data)
    }

    const ip = getIp(req)
    if (rateLimited(ip)) return res.status(429).json({ error: 'too many requests' })

    const body = req.body ?? {}
    const items = Array.isArray(body.items) ? body.items.slice(0, 100) : []
    if (items.length === 0) return res.status(400).json({ error: 'cart is empty' })

    // Parse cart lines. Client sends offset ids (1_000_042) in `id`; optional
    // `db_id` is the real admin_products row. Prices/titles are re-fetched below.
    const parsed = []
    for (const it of items) {
      if (!it || typeof it !== 'object') continue
      const rawId = typeof it.id === 'number' ? it.id : (typeof it.db_id === 'number' ? it.db_id : null)
      const dbId = toDbProductId(rawId)
      const qty = typeof it.quantity === 'number' && Number.isInteger(it.quantity) && it.quantity > 0 ? it.quantity : 1
      if (!dbId) continue
      parsed.push({
        dbId,
        cartId: clientCartProductId(dbId, rawId),
        title: s(it.title, 200),
        quantity: qty,
      })
    }
    if (parsed.length === 0) return res.status(400).json({ error: 'cart is empty' })

    const dbIds = [...new Set(parsed.map((it) => it.dbId))]
    const catalogById = new Map()
    // Track which catalog table this deployment actually uses so the stock
    // decrement below writes to the same one (legacy shops use `products`).
    let productsTable = 'admin_products'
    if (dbIds.length > 0) {
      let pr = await supabase
        .from('admin_products')
        .select('id, price, title, brand, quantity')
        .in('id', dbIds)
      if (pr.error && /admin_products/i.test(pr.error.message)) {
        productsTable = 'products'
        pr = await supabase.from('products').select('id, price, title, brand, quantity').in('id', dbIds)
      }
      if (!pr.error && Array.isArray(pr.data)) {
        for (const p of pr.data) catalogById.set(p.id, p)
      }
    }

    const safeItems = []
    const missing = []
    for (const it of parsed) {
      const row = catalogById.get(it.dbId)
      if (!row) {
        missing.push(it.dbId)
        continue
      }
      const price = typeof row.price === 'number' && Number.isFinite(row.price) ? row.price : 0
      const title = s(String(row.title || row.brand || it.title), 200)
      safeItems.push({
        id: it.dbId,
        cartId: it.cartId,
        title,
        price,
        quantity: it.quantity,
      })
    }
    if (missing.length > 0) {
      return res.status(400).json({ error: 'unknown_products', ids: missing })
    }
    if (safeItems.length === 0) return res.status(400).json({ error: 'cart is empty' })

    // ── Stock check ───────────────────────────────────────────────────
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
              product_id: it.cartId ?? it.id,
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
            // Atomic claim: only apply the discount if a conditional UPDATE
            // succeeded. The WHERE clause guarantees we don't go over
            // max_uses even under concurrent orders (Postgres row-level lock
            // ensures sequential UPDATE semantics for the same row).
            //
            // Optional migration (preferred — single statement):
            //   CREATE OR REPLACE FUNCTION claim_promo_use(p_code TEXT)
            //   RETURNS BOOLEAN LANGUAGE plpgsql AS $$
            //   DECLARE rows_updated INTEGER;
            //   BEGIN
            //     UPDATE promo_codes SET used_count = used_count + 1
            //     WHERE code = p_code
            //       AND (max_uses IS NULL OR used_count < max_uses);
            //     GET DIAGNOSTICS rows_updated = ROW_COUNT;
            //     RETURN rows_updated > 0;
            //   END $$;
            //   GRANT EXECUTE ON FUNCTION claim_promo_use(TEXT) TO service_role;
            let claimed = false
            const rpc = await supabase.rpc('claim_promo_use', { p_code: code })
            if (!rpc.error && rpc.data === true) {
              claimed = true
            } else if (!c.max_uses) {
              // Unlimited code — bump for analytics, no race risk.
              await supabase
                .from('promo_codes')
                .update({ used_count: (c.used_count ?? 0) + 1 })
                .eq('code', code)
                .then(() => undefined, () => undefined)
              claimed = true
            } else {
              // Capped code, RPC missing — fallback non-atomic guarded write.
              // Only count the claim if the conditional UPDATE actually matched
              // a row (used_count < max_uses). Previously `claimed` was set to
              // true unconditionally, so an exhausted code still granted the
              // discount and over-incremented used_count.
              const upd = await supabase
                .from('promo_codes')
                .update({ used_count: (c.used_count ?? 0) + 1 })
                .eq('code', code)
                .lt('used_count', c.max_uses)
                .select('code')
              claimed = !upd.error && Array.isArray(upd.data) && upd.data.length > 0
            }
            if (claimed) {
              const discount = c.kind === 'percent'
                ? Math.round(subtotal * (Number(c.value) || 0) / 100)
                : Math.min(subtotal, Math.round(Number(c.value) || 0))
              total = Math.max(0, subtotal - discount)
              promoApplied = { code: c.code, kind: c.kind, value: c.value, discount }
            }
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
      if (promoApplied && !error) {
        // Promo use was already claimed (used_count bumped) but this DB has no
        // promo_code/promo_discount columns to record which order consumed it.
        // Surface it so the admin can reconcile; applying the orders migration
        // makes this branch unreachable.
        console.warn(`[orders] promo ${promoApplied.code} (−${promoApplied.discount}) applied to order ${data?.id ?? '?'} but not recorded — run the orders promo-columns migration`)
      }
    }

    if (error) {
      if (isTableMissing(error)) return res.status(503).json({ error: 'table_not_found', detail: error.message })
      return res.status(500).json({ error: 'failed to save order', detail: error.message })
    }

    // ── Decrement stock ──────────────────────────────────────────────
    // Atomic stock decrement.
    //
    // Two concurrent orders of the same item used to race on read-modify-
    // write (both see qty=10, both write qty=5 — oversold by 5). The fix
    // is a Postgres-side function that does the decrement in a single
    // statement with a guard predicate:
    //
    //   CREATE OR REPLACE FUNCTION decrement_product_quantity(
    //     p_id BIGINT, p_delta INTEGER
    //   ) RETURNS INTEGER LANGUAGE plpgsql AS $$
    //   DECLARE new_qty INTEGER;
    //   BEGIN
    //     UPDATE admin_products
    //     SET quantity = quantity - p_delta
    //     WHERE id = p_id AND quantity >= p_delta
    //     RETURNING quantity INTO new_qty;
    //     RETURN new_qty;  -- NULL if not enough stock
    //   END $$;
    //   GRANT EXECUTE ON FUNCTION decrement_product_quantity(BIGINT, INTEGER) TO service_role;
    //
    // We try the RPC first (atomic). If it returns an error (e.g. the
    // function is missing on older deployments) we fall back to the
    // simple read-modify-write — race-prone but acceptable when traffic
    // is low. Document the migration so future deploys patch the race.
    //
    // Sequential await — keeps DB load light + serialises updates per
    // product. Each product is its own row anyway.
    for (const it of safeItems) {
      if (!Number.isInteger(it.id) || it.quantity <= 0) continue
      try {
        const rpc = await supabase.rpc('decrement_product_quantity', { p_id: it.id, p_delta: it.quantity })
        if (!rpc.error) continue
        // Fallback: non-atomic read-modify-write against whichever catalog
        // table this deployment uses. Previously this always hit
        // `admin_products`, so shops on the legacy `products` table never had
        // stock decremented at all (silent infinite oversell).
        const got = await supabase.from(productsTable).select('quantity').eq('id', it.id).maybeSingle()
        if (got.error || !got.data || typeof got.data.quantity !== 'number') continue
        const next = Math.max(0, got.data.quantity - it.quantity)
        await supabase.from(productsTable).update({ quantity: next }).eq('id', it.id)
      } catch {
        // Per-item failure must not break the order — admin reconciles.
      }
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

  if (req.method === 'DELETE' && req.query.promo === '1') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })
    const code = String(req.body?.code ?? '').toUpperCase().slice(0, 32)
    if (!/^[A-Z0-9_-]{2,32}$/.test(code)) return res.status(400).json({ error: 'invalid code' })
    const r = await supabase.from('promo_codes').delete().eq('code', code)
    if (r.error) return res.status(500).json({ error: r.error.message })
    await writeAuditLog(supabase, req, {
      action: 'promo.delete',
      entity: 'promo',
      entity_id: code,
      summary: `Удалён промокод ${code}`,
    })
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
    // Day boundary in the shop's timezone (Europe/Moscow, UTC+3, no DST).
    // Serverless runs in UTC, so `setHours` would put the "today" cutoff at
    // 00:00 UTC = 03:00 MSK, mis-bucketing 3 hours of orders every night.
    const MSK_OFFSET_MS = 3 * 60 * 60 * 1000
    const mskMidnight = new Date(now + MSK_OFFSET_MS)
    mskMidnight.setUTCHours(0, 0, 0, 0)
    const sinceToday = new Date(mskMidnight.getTime() - MSK_OFFSET_MS).toISOString()
    const sinceYesterday = new Date(mskMidnight.getTime() - MSK_OFFSET_MS - day).toISOString()

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
    // Snapshot before so we can diff in the audit log.
    const beforeSnap = await supabase.from('orders').select('status, tracking_number, tracking_carrier, customer_name').eq('id', id).maybeSingle()
    const before = beforeSnap.data ?? {}
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
    const ORDER_ALIASES = {
      status: 'статус',
      tracking_number: 'трек-номер',
      tracking_carrier: 'служба доставки',
    }
    const STATUS_LABELS_RU = { new: 'новый', in_progress: 'в работе', done: 'выполнен', cancelled: 'отменён' }
    const beforePretty = { ...before, status: before.status ? STATUS_LABELS_RU[before.status] ?? before.status : before.status }
    const afterPretty = { ...data, status: data?.status ? STATUS_LABELS_RU[data.status] ?? data.status : data?.status }
    const changes = diffRecords(beforePretty, afterPretty, {
      fields: Object.keys(patch),
      aliases: ORDER_ALIASES,
    })
    await writeAuditLog(supabase, req, {
      action: 'order.update',
      entity: 'order',
      entity_id: String(id),
      summary: changes.length === 0
        ? `Заказ #${id}: без изменений`
        : `Заказ #${id} (${before.customer_name || data?.customer_name || ''})`,
      meta: { customer_name: data?.customer_name },
      changes,
    })
    return res.status(200).json(data)
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {}
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' })
    const snap = await supabase.from('orders').select('customer_name, total, status').eq('id', id).maybeSingle()
    const { error } = await supabase.from('orders').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    const tail = snap.data
      ? ` (${snap.data.customer_name || '—'}, ${typeof snap.data.total === 'number' ? snap.data.total.toLocaleString('ru-RU') + ' ₽' : '—'})`
      : ''
    await writeAuditLog(supabase, req, {
      action: 'order.delete',
      entity: 'order',
      entity_id: String(id),
      summary: `Удалён заказ #${id}${tail}`,
      meta: snap.data ?? {},
    })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
