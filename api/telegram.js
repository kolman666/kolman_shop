// Simple in-memory rate limiter (resets on cold start)
const RL_WINDOW_MS = 60 * 1000
const RL_MAX = 10
const rlMap = new Map() // ip -> { count, resetAt }

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  return (typeof fwd === 'string' ? fwd.split(',')[0] : fwd?.[0])?.trim() ?? 'unknown'
}

function rateLimited(ip) {
  const now = Date.now()
  const entry = rlMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rlMap.set(ip, { count: 1, resetAt: now + RL_WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > RL_MAX
}

const ALLOWED_PARSE_MODES = new Set(['HTML', 'Markdown', 'MarkdownV2'])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' })
  }

  const ip = getClientIp(req)
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'too many requests, try again in a minute' })
  }

  const token = process.env.TG_BOT_TOKEN
  const chatId = process.env.TG_CHAT_ID

  if (!token || !chatId) {
    return res.status(500).json({
      error: 'telegram not configured',
      detail: 'set TG_BOT_TOKEN and TG_CHAT_ID environment variables on the server',
    })
  }

  const body = req.body ?? {}
  const text = typeof body.text === 'string' ? body.text : ''
  if (!text.trim()) {
    return res.status(400).json({ error: 'missing text' })
  }
  const safeText = text.slice(0, 4000)

  // Optional parse_mode — default to HTML (simpler escaping than Markdown)
  let parseMode = 'HTML'
  if (typeof body.parse_mode === 'string') {
    if (!ALLOWED_PARSE_MODES.has(body.parse_mode)) {
      return res.status(400).json({ error: 'invalid parse_mode' })
    }
    parseMode = body.parse_mode
  }

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: safeText,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    })

    if (!tgRes.ok) {
      let detail = 'telegram api returned ' + tgRes.status
      try {
        const errBody = await tgRes.json()
        if (errBody && typeof errBody.description === 'string') detail = errBody.description
      } catch {
        // fallthrough
      }
      return res.status(502).json({ error: 'telegram api error', detail })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({
      error: 'internal error',
      detail: err instanceof Error ? err.message : String(err),
    })
  }
}
