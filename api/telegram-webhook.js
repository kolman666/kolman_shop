// Telegram Bot webhook handler.
//
// SETUP (run once after deploy):
//   curl -X POST "https://api.telegram.org/bot<TG_BOT_TOKEN>/setWebhook" \
//        -H "Content-Type: application/json" \
//        -d '{"url":"https://YOUR_DOMAIN/api/telegram-webhook","secret_token":"<TG_WEBHOOK_SECRET>","allowed_updates":["message","callback_query"]}'
//
// ENV:
//   TG_BOT_TOKEN          — bot token from @BotFather
//   TG_WEBHOOK_SECRET     — random secret you choose; passed back by Telegram in X-Telegram-Bot-Api-Secret-Token header
//   TG_ADMIN_USER_IDS     — comma-separated Telegram numeric user ids that are allowed to use the bot
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — for DB access
import { createClient } from '@supabase/supabase-js'
import { safeEqual } from './_lib/auth.js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

const CATEGORY_LABELS = {
  order: 'проблема с заказом',
  product: 'вопрос о товаре',
  choose: 'помощь с выбором',
  delivery: 'доставка и оплата',
  other: 'другое',
}
const ORDER_STATUS_LABELS = {
  new: 'новый',
  in_progress: 'в работе',
  done: 'выполнен',
  cancelled: 'отменён',
}
const INQUIRY_STATUS_LABELS = {
  new: 'новые',
  in_progress: 'в работе',
  done: 'закрытые',
}

const PAGE_SIZE = 5

function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function getAdminIds() {
  const raw = process.env.TG_ADMIN_USER_IDS
  if (!raw) return null // null = no allowlist (open)
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))
}

function isAdmin(userId) {
  const allowed = getAdminIds()
  if (!allowed) return true
  return allowed.has(String(userId))
}

async function tgApi(method, body) {
  const token = process.env.TG_BOT_TOKEN
  if (!token) return { ok: false, detail: 'no token' }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!r.ok) {
      let detail = `${method} ${r.status}`
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

function sendMessage(chatId, text, replyMarkup) {
  return tgApi('sendMessage', {
    chat_id: chatId,
    text: text.slice(0, 4000),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

function editMessage(chatId, messageId, text, replyMarkup) {
  return tgApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: text.slice(0, 4000),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  })
}

function answerCallback(callbackId, text) {
  return tgApi('answerCallbackQuery', { callback_query_id: callbackId, ...(text ? { text } : {}) })
}

// ── Renderers ─────────────────────────────────────────────────────────────────

// Short codes for status, used in callback_data to stay within Telegram's 64-byte limit.
const O_STATUS_CODES = { n: 'new', w: 'in_progress', d: 'done', c: 'cancelled' }
const O_CODE_BY_STATUS = { new: 'n', in_progress: 'w', done: 'd', cancelled: 'c' }
const I_STATUS_CODES = { n: 'new', w: 'in_progress', d: 'done' }
const I_CODE_BY_STATUS = { new: 'n', in_progress: 'w', done: 'd' }

function orderItemStatusButtons(orderId, currentStatus, filter, page) {
  // Per-item status buttons. Highlight current with •.
  const choices = [
    { code: 'n', label: 'новый' },
    { code: 'w', label: 'работа' },
    { code: 'd', label: 'готово' },
    { code: 'c', label: 'отмена' },
  ]
  const filterCode = filter === 'all' ? 'a' : (O_CODE_BY_STATUS[filter] ?? 'a')
  return choices.map((ch) => {
    const isCurrent = O_STATUS_CODES[ch.code] === currentStatus
    return {
      text: (isCurrent ? '• ' : '') + `#${orderId} ${ch.label}`,
      // os = order set status; format: os:<id>:<newCode>:<filterCode>:<page>
      callback_data: `os:${orderId}:${ch.code}:${filterCode}:${page}`,
    }
  })
}

function ordersKeyboard(activeStatus, page, hasNext, items = []) {
  const tabs = [
    { label: 'все', value: 'all' },
    { label: 'новые', value: 'new' },
    { label: 'в работе', value: 'in_progress' },
    { label: 'выполнены', value: 'done' },
    { label: 'отмена', value: 'cancelled' },
  ]
  const filterCode = activeStatus === 'all' ? 'a' : (O_CODE_BY_STATUS[activeStatus] ?? 'a')
  const tabRow = tabs.map((t) => {
    const tCode = t.value === 'all' ? 'a' : (O_CODE_BY_STATUS[t.value] ?? 'a')
    return {
      text: (activeStatus === t.value ? '• ' : '') + t.label,
      callback_data: `o:${tCode}:0`,
    }
  })
  // For each visible item: 4 small status-change buttons in two rows of two (compact)
  const itemRows = []
  for (const it of items) {
    const buttons = orderItemStatusButtons(it.id, it.status, activeStatus, page)
    itemRows.push(buttons.slice(0, 2))
    itemRows.push(buttons.slice(2))
  }
  const navRow = []
  if (page > 0) navRow.push({ text: '« назад', callback_data: `o:${filterCode}:${page - 1}` })
  if (hasNext) navRow.push({ text: 'вперёд »', callback_data: `o:${filterCode}:${page + 1}` })
  navRow.push({ text: '🔄 обновить', callback_data: `o:${filterCode}:${page}` })
  return { inline_keyboard: [tabRow, ...itemRows, navRow] }
}

// Short category codes for inquiries (a=all, o=order, p=product, h=choose, l=delivery, x=other)
const I_CAT_CODES = { a: 'all', o: 'order', p: 'product', h: 'choose', l: 'delivery', x: 'other' }
const I_CODE_BY_CAT = { all: 'a', order: 'o', product: 'p', choose: 'h', delivery: 'l', other: 'x' }

function inquiryItemStatusButtons(inquiryId, currentStatus, category, statusFilter, page) {
  const choices = [
    { code: 'n', label: 'новая' },
    { code: 'w', label: 'работа' },
    { code: 'd', label: 'закрыта' },
  ]
  const catCode = I_CODE_BY_CAT[category] ?? 'a'
  const sCode = statusFilter === 'all' ? 'a' : (I_CODE_BY_STATUS[statusFilter] ?? 'a')
  return choices.map((ch) => {
    const isCurrent = I_STATUS_CODES[ch.code] === currentStatus
    return {
      text: (isCurrent ? '• ' : '') + `#${inquiryId} ${ch.label}`,
      // is = inquiry set status; format: is:<id>:<newCode>:<catCode>:<sCode>:<page>
      callback_data: `is:${inquiryId}:${ch.code}:${catCode}:${sCode}:${page}`,
    }
  })
}

function inquiriesKeyboard(activeCategory, activeStatus, page, hasNext, items = []) {
  const catCode = I_CODE_BY_CAT[activeCategory] ?? 'a'
  const sCode = activeStatus === 'all' ? 'a' : (I_CODE_BY_STATUS[activeStatus] ?? 'a')
  const catRow = [
    { label: 'все', value: 'all', code: 'a' },
    { label: 'заказ', value: 'order', code: 'o' },
    { label: 'товар', value: 'product', code: 'p' },
    { label: 'выбор', value: 'choose', code: 'h' },
    { label: 'доставка', value: 'delivery', code: 'l' },
    { label: 'другое', value: 'other', code: 'x' },
  ].map((t) => ({
    text: (activeCategory === t.value ? '• ' : '') + t.label,
    callback_data: `i:${t.code}:${sCode}:0`,
  }))
  const statusRow = [
    { label: 'все', value: 'all', code: 'a' },
    { label: 'новые', value: 'new', code: 'n' },
    { label: 'в работе', value: 'in_progress', code: 'w' },
    { label: 'закрытые', value: 'done', code: 'd' },
  ].map((t) => ({
    text: (activeStatus === t.value ? '• ' : '') + t.label,
    callback_data: `i:${catCode}:${t.code}:0`,
  }))
  const itemRows = []
  for (const it of items) {
    const buttons = inquiryItemStatusButtons(it.id, it.status, activeCategory, activeStatus, page)
    itemRows.push(buttons)
  }
  const navRow = []
  if (page > 0) navRow.push({ text: '« назад', callback_data: `i:${catCode}:${sCode}:${page - 1}` })
  if (hasNext) navRow.push({ text: 'вперёд »', callback_data: `i:${catCode}:${sCode}:${page + 1}` })
  navRow.push({ text: '🔄 обновить', callback_data: `i:${catCode}:${sCode}:${page}` })
  return { inline_keyboard: [catRow, statusRow, ...itemRows, navRow] }
}

function formatOrder(o) {
  const date = new Date(o.created_at)
  const dateStr = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  const itemsText = Array.isArray(o.items)
    ? o.items.map((it) => `   • ${escapeHtml(it.title ?? '?')} × ${it.quantity ?? 1}`).join('\n')
    : ''
  return [
    `🛒 <b>#${o.id}</b> · ${dateStr} · <i>${escapeHtml(ORDER_STATUS_LABELS[o.status] ?? o.status)}</i>`,
    `   👤 ${escapeHtml(o.customer_name) || '—'}  📞 ${escapeHtml(o.customer_contact) || '—'}`,
    `   🚚 ${escapeHtml(o.delivery) || '—'}  💰 <b>${Number(o.total ?? 0).toLocaleString('ru-RU')} ₽</b>`,
    itemsText,
    o.comment ? `   💬 ${escapeHtml(o.comment)}` : '',
  ].filter(Boolean).join('\n')
}

function formatInquiry(q) {
  const date = new Date(q.created_at)
  const dateStr = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return [
    `📋 <b>#${q.id}</b> · ${dateStr} · <i>${escapeHtml(CATEGORY_LABELS[q.category] ?? q.category)}</i> · ${escapeHtml(INQUIRY_STATUS_LABELS[q.status] ?? q.status)}`,
    `   👤 ${escapeHtml(q.customer_name) || '—'}  📞 ${escapeHtml(q.customer_contact) || '—'}`,
    `   💬 ${escapeHtml((q.message ?? '').slice(0, 400))}`,
  ].join('\n')
}

async function buildOrdersView(supabase, status, page) {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE // we ask for one extra to know if there's a next page
  let q = supabase.from('orders').select('*').order('created_at', { ascending: false }).range(from, to)
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) {
    const missing = error.message.includes('does not exist') || error.code === '42P01'
    return { text: missing ? '⚠️ таблица orders не создана. запустите миграцию.' : '⚠️ ' + error.message, keyboard: ordersKeyboard(status, page, false, []) }
  }
  const rows = data ?? []
  const hasNext = rows.length > PAGE_SIZE
  const visible = hasNext ? rows.slice(0, PAGE_SIZE) : rows
  const header = `<b>🛒 заказы</b> · фильтр: <i>${status === 'all' ? 'все' : escapeHtml(ORDER_STATUS_LABELS[status] ?? status)}</i> · стр. ${page + 1}`
  if (visible.length === 0) {
    return { text: `${header}\n\nпусто.`, keyboard: ordersKeyboard(status, page, false, []) }
  }
  const body = visible.map(formatOrder).join('\n\n────────────\n')
  return { text: `${header}\n\n${body}`, keyboard: ordersKeyboard(status, page, hasNext, visible) }
}

async function buildInquiriesView(supabase, category, status, page) {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE
  let q = supabase.from('inquiries').select('*').order('created_at', { ascending: false }).range(from, to)
  if (category !== 'all') q = q.eq('category', category)
  if (status !== 'all') q = q.eq('status', status)
  const { data, error } = await q
  if (error) {
    const missing = error.message.includes('does not exist') || error.code === '42P01'
    return { text: missing ? '⚠️ таблица inquiries не создана. запустите миграцию.' : '⚠️ ' + error.message, keyboard: inquiriesKeyboard(category, status, page, false, []) }
  }
  const rows = data ?? []
  const hasNext = rows.length > PAGE_SIZE
  const visible = hasNext ? rows.slice(0, PAGE_SIZE) : rows
  const header = `<b>📋 заявки</b> · категория: <i>${category === 'all' ? 'все' : escapeHtml(CATEGORY_LABELS[category] ?? category)}</i> · статус: <i>${status === 'all' ? 'все' : escapeHtml(INQUIRY_STATUS_LABELS[status] ?? status)}</i> · стр. ${page + 1}`
  if (visible.length === 0) {
    return { text: `${header}\n\nпусто.`, keyboard: inquiriesKeyboard(category, status, page, false, []) }
  }
  const body = visible.map(formatInquiry).join('\n\n────────────\n')
  return { text: `${header}\n\n${body}`, keyboard: inquiriesKeyboard(category, status, page, hasNext, visible) }
}

const HELP_TEXT = [
  '<b>панель управления магазина</b>',
  '',
  '/orders — заказы (фильтр по статусу + смена статуса кнопками)',
  '/inquiries — заявки в поддержку (фильтр по категории/статусу + смена статуса кнопками)',
  '/help — это сообщение',
  '',
  'смена статуса:',
  'под каждым заказом/заявкой — кнопки. нажатие меняет статус и обновляет список.',
  'текущий статус помечен «•».',
].join('\n')

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' })

  // Verify webhook secret (Telegram sends it in this header when set via setWebhook).
  // Constant-time compare — was a plain `!==`, vulnerable to timing brute-force.
  //
  // Fail CLOSED when no secret is configured. Previously a missing
  // TG_WEBHOOK_SECRET skipped the check entirely, turning this into an
  // unauthenticated endpoint that drives the admin bot (changing order /
  // inquiry statuses via crafted callback_query payloads). Require the secret.
  const expected = process.env.TG_WEBHOOK_SECRET
  if (!expected) {
    console.error('[telegram-webhook] TG_WEBHOOK_SECRET is not set — refusing to process updates')
    return res.status(503).json({ error: 'webhook secret not configured' })
  }
  const got = req.headers['x-telegram-bot-api-secret-token']
  if (typeof got !== 'string' || !safeEqual(got, expected)) {
    return res.status(401).json({ error: 'invalid webhook secret' })
  }

  const update = req.body
  if (!update || typeof update !== 'object') return res.status(200).json({ ok: true })

  let supabase
  try {
    supabase = getSupabase()
  } catch {
    return res.status(200).json({ ok: true }) // swallow errors so Telegram doesn't retry forever
  }

  try {
    if (update.message && update.message.text) {
      const msg = update.message
      const chatId = msg.chat.id
      const userId = msg.from?.id
      if (!isAdmin(userId)) {
        await sendMessage(chatId, 'доступ запрещён.')
        return res.status(200).json({ ok: true })
      }
      const text = (msg.text || '').trim()

      if (text.startsWith('/start') || text.startsWith('/help')) {
        await sendMessage(chatId, HELP_TEXT)
      } else if (text.startsWith('/orders')) {
        const view = await buildOrdersView(supabase, 'new', 0)
        await sendMessage(chatId, view.text, view.keyboard)
      } else if (text.startsWith('/inquiries')) {
        const view = await buildInquiriesView(supabase, 'all', 'new', 0)
        await sendMessage(chatId, view.text, view.keyboard)
      } else {
        await sendMessage(chatId, 'команда не распознана. /help для списка.')
      }
      return res.status(200).json({ ok: true })
    }

    if (update.callback_query) {
      const cq = update.callback_query
      const userId = cq.from?.id
      const chatId = cq.message?.chat?.id
      const messageId = cq.message?.message_id
      if (!isAdmin(userId)) {
        await answerCallback(cq.id, 'доступ запрещён')
        return res.status(200).json({ ok: true })
      }
      const data = (cq.data || '').split(':')
      const kind = data[0]

      if (kind === 'o') {
        // o:<filterCode>:<page>  — switch tab / paginate orders
        const filterCode = data[1] || 'a'
        const status = filterCode === 'a' ? 'all' : (O_STATUS_CODES[filterCode] ?? 'all')
        const page = Math.max(0, parseInt(data[2] || '0', 10) || 0)
        const view = await buildOrdersView(supabase, status, page)
        await Promise.all([
          editMessage(chatId, messageId, view.text, view.keyboard),
          answerCallback(cq.id),
        ])
      } else if (kind === 'os') {
        // os:<id>:<newCode>:<filterCode>:<page>  — change order status
        const id = parseInt(data[1] || '', 10)
        const newCode = data[2] || ''
        const newStatus = O_STATUS_CODES[newCode]
        const filterCode = data[3] || 'a'
        const page = Math.max(0, parseInt(data[4] || '0', 10) || 0)
        const status = filterCode === 'a' ? 'all' : (O_STATUS_CODES[filterCode] ?? 'all')
        if (!Number.isInteger(id) || !newStatus) {
          await answerCallback(cq.id, 'некорректные данные')
        } else {
          const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id)
          if (error) {
            await answerCallback(cq.id, 'ошибка: ' + error.message.slice(0, 150))
          } else {
            const [view] = await Promise.all([
              buildOrdersView(supabase, status, page),
              answerCallback(cq.id, `#${id} → ${ORDER_STATUS_LABELS[newStatus] ?? newStatus}`),
            ])
            await editMessage(chatId, messageId, view.text, view.keyboard)
          }
        }
      } else if (kind === 'i') {
        // i:<catCode>:<sCode>:<page>  — switch inquiry filters / paginate
        const catCode = data[1] || 'a'
        const sCode = data[2] || 'a'
        const category = I_CAT_CODES[catCode] ?? 'all'
        const status = sCode === 'a' ? 'all' : (I_STATUS_CODES[sCode] ?? 'all')
        const page = Math.max(0, parseInt(data[3] || '0', 10) || 0)
        const view = await buildInquiriesView(supabase, category, status, page)
        await Promise.all([
          editMessage(chatId, messageId, view.text, view.keyboard),
          answerCallback(cq.id),
        ])
      } else if (kind === 'is') {
        // is:<id>:<newCode>:<catCode>:<sCode>:<page>  — change inquiry status
        const id = parseInt(data[1] || '', 10)
        const newCode = data[2] || ''
        const newStatus = I_STATUS_CODES[newCode]
        const catCode = data[3] || 'a'
        const sCode = data[4] || 'a'
        const page = Math.max(0, parseInt(data[5] || '0', 10) || 0)
        const category = I_CAT_CODES[catCode] ?? 'all'
        const status = sCode === 'a' ? 'all' : (I_STATUS_CODES[sCode] ?? 'all')
        if (!Number.isInteger(id) || !newStatus) {
          await answerCallback(cq.id, 'некорректные данные')
        } else {
          const { error } = await supabase.from('inquiries').update({ status: newStatus }).eq('id', id)
          if (error) {
            await answerCallback(cq.id, 'ошибка: ' + error.message.slice(0, 150))
          } else {
            const [view] = await Promise.all([
              buildInquiriesView(supabase, category, status, page),
              answerCallback(cq.id, `#${id} → ${INQUIRY_STATUS_LABELS[newStatus] ?? newStatus}`),
            ])
            await editMessage(chatId, messageId, view.text, view.keyboard)
          }
        }
      } else {
        await answerCallback(cq.id, 'неизвестная команда')
      }
      return res.status(200).json({ ok: true })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    // Always 200 for telegram so it doesn't retry endlessly
    console.error('[telegram-webhook]', err)
    return res.status(200).json({ ok: true })
  }
}
