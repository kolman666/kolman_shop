// In-memory rate limiting (resets on cold start — good enough for basic brute-force protection)
import { safeEqual } from './_lib/auth.js'

const attempts = new Map() // ip -> { count, resetAt }
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  return (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded?.[0])?.trim() ?? 'unknown'
}

function checkRateLimit(ip) {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) return false
  return entry.count >= MAX_ATTEMPTS
}

function recordFailedAttempt(ip) {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    entry.count++
  }
}

function clearAttempts(ip) {
  attempts.delete(ip)
}

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' })
  }

  const ip = getClientIp(req)

  if (checkRateLimit(ip)) {
    return res.status(429).json({ error: 'too many attempts, try again later' })
  }

  const body = req.body ?? {}
  const secret = typeof body.secret === 'string' ? body.secret : ''
  const adminSecret = process.env.ADMIN_SECRET

  if (!adminSecret) {
    return res.status(500).json({ error: 'admin not configured' })
  }

  if (safeEqual(secret, adminSecret)) {
    clearAttempts(ip)
    return res.status(200).json({ ok: true })
  }

  recordFailedAttempt(ip)
  return res.status(401).json({ error: 'invalid secret' })
}
