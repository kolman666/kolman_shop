// Backend helpers for the `auth_users` table — password hashing + bearer
// tokens. Uses Node's built-in crypto so no extra deps.
//
// Token format (compact, stateless, no DB hits to validate):
//   "<userId>.<expiryUnixSec>.<base64url(HMAC-SHA256(userId.expiry, AUTH_TOKEN_SECRET))>"
//
// We rotate password hashes lazily on successful login if the params change.

import { pbkdf2Sync, randomBytes, createHmac, timingSafeEqual } from 'node:crypto'

const PBKDF2_ITER = 150_000
const PBKDF2_KEYLEN = 32
const SALT_LEN = 16
const TOKEN_TTL_SEC = 30 * 24 * 60 * 60 // 30 days

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(v) {
  return typeof v === 'string' && v.length <= 200 && EMAIL_RE.test(v)
}

export function normalizeEmail(v) {
  return String(v ?? '').trim().toLowerCase()
}

export function hashPassword(plain) {
  const salt = randomBytes(SALT_LEN)
  const hash = pbkdf2Sync(plain, salt, PBKDF2_ITER, PBKDF2_KEYLEN, 'sha256')
  return {
    password_hash: hash.toString('hex'),
    password_salt: salt.toString('hex'),
    password_iterations: PBKDF2_ITER,
  }
}

export function verifyPassword(plain, row) {
  if (!row || typeof row.password_hash !== 'string' || typeof row.password_salt !== 'string') {
    return false
  }
  const iter = Number(row.password_iterations) || PBKDF2_ITER
  const salt = Buffer.from(row.password_salt, 'hex')
  const expected = Buffer.from(row.password_hash, 'hex')
  const got = pbkdf2Sync(plain, salt, iter, expected.length, 'sha256')
  if (got.length !== expected.length) return false
  return timingSafeEqual(got, expected)
}

function getTokenSecret() {
  // Falls back to ADMIN_SECRET only as a last resort so the system at least
  // boots locally; production should set AUTH_TOKEN_SECRET explicitly to a
  // long random string.
  const v = process.env.AUTH_TOKEN_SECRET || process.env.ADMIN_SECRET
  if (!v) throw new Error('AUTH_TOKEN_SECRET not configured')
  return v
}

function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

export function issueToken(userId) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC
  const payload = `${userId}.${exp}`
  const sig = createHmac('sha256', getTokenSecret()).update(payload).digest()
  return `${payload}.${b64urlEncode(sig)}`
}

// Deterministic, non-guessable personal referral code for a user. Derived via
// HMAC so it can't be enumerated (REF1, REF2…) but is stable across calls.
// Format matches the promo-code regex [A-Z0-9_-]{2,32}.
export function referralCode(userId) {
  const sig = createHmac('sha256', getTokenSecret()).update(`ref:${userId}`).digest('hex')
  return `REF${sig.slice(0, 6).toUpperCase()}`
}

// Returns the user id encoded in a valid, non-expired token, or null.
export function verifyToken(token) {
  if (typeof token !== 'string' || token.length > 512) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userIdStr, expStr, sigStr] = parts
  const userId = Number(userIdStr)
  const exp = Number(expStr)
  if (!Number.isInteger(userId) || userId <= 0) return null
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null
  let expected, given
  try {
    expected = createHmac('sha256', getTokenSecret()).update(`${userIdStr}.${expStr}`).digest()
    given = b64urlDecode(sigStr)
  } catch {
    return null
  }
  if (given.length !== expected.length) return null
  if (!timingSafeEqual(given, expected)) return null
  return userId
}

// Pull bearer token from an Authorization header.
export function tokenFromRequest(req) {
  const auth = req.headers.authorization || req.headers.Authorization
  if (typeof auth !== 'string') return null
  const m = auth.match(/^Bearer\s+(\S+)$/i)
  return m ? m[1] : null
}

// Fetch the authenticated user (or null). Shared by every endpoint that
// needs to verify "the request was made by the user it claims".
//
// Usage:
//   const me = await requireUser(req, supabase)
//   if (!me) return res.status(401).json({ error: 'unauthorized' })
export async function requireUser(req, supabase) {
  const token = tokenFromRequest(req)
  if (!token) return null
  const userId = verifyToken(token)
  if (!userId) return null
  const { data, error } = await supabase
    .from('auth_users')
    .select('id, email, name')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return data
}

// Returns true when the request is signed for the given email address.
// Used by customer endpoints that take `?my=<email>` / `body.email` so a
// shopper can't fetch another user's orders / messages / etc. by simply
// guessing their email.
//
// We compare emails case-insensitively; both sides are normalised.
export async function requestOwnsEmail(req, supabase, claimedEmail) {
  if (typeof claimedEmail !== 'string' || !claimedEmail) return false
  const me = await requireUser(req, supabase)
  if (!me) return false
  return normalizeEmail(me.email) === normalizeEmail(claimedEmail)
}

// Public-shape user record returned to the client. Strips password material
// and any internal flags.
export function publicUser(row) {
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name || '',
    firstName: row.first_name || '',
    lastName: row.last_name || '',
    phone: row.phone || '',
    photo: row.photo || '',
    telegram: row.telegram || '',
    // Optional — only present once the SQL migration adding the column is
    // applied (see /api/auth?action=heartbeat for the migration snippet).
    lastSeenAt: row.last_seen_at ?? null,
  }
}
