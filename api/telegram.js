// Vercel serverless function — бот-токен живёт только здесь, в браузер не попадает
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' })
  }

  const token = process.env.TG_BOT_TOKEN
  const chatId = process.env.TG_CHAT_ID

  if (!token || !chatId) {
    return res.status(500).json({ error: 'telegram not configured' })
  }

  const { text } = req.body ?? {}
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'missing text' })
  }
  const safeText = text.slice(0, 4000)

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: safeText }),
    })

    if (!r.ok) {
      const body = await r.text()
      return res.status(502).json({ error: 'telegram api error', detail: body })
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: 'internal error' })
  }
}
