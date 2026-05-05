import { createClient } from '@supabase/supabase-js'
import { isAdminAuthorized, isSafeHttpUrl, isSafeLinkOrPath } from './_lib/auth.js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

const ALLOWED_KEYS = new Set([
  'hero_slides',
  'homepage_categories',
  'homepage_perks',
  'search_popular_sections',
])

// Strip ASCII control characters and clamp length.
const CONTROL_CHARS_RE = new RegExp('[\\u0000-\\u001F\\u007F]', 'g')
function clean(s, max) {
  if (typeof s !== 'string') return ''
  return s.replace(CONTROL_CHARS_RE, '').slice(0, max)
}

const FORBIDDEN_KEY_CHARS_RE = /[\s"'<>`]/

const VALIDATORS = {
  hero_slides(value) {
    if (!Array.isArray(value)) return { ok: false, error: 'hero_slides must be an array' }
    if (value.length > 30) return { ok: false, error: 'too many slides' }
    const cleaned = []
    for (const item of value) {
      if (!item || typeof item !== 'object') return { ok: false, error: 'each slide must be an object' }
      const image = typeof item.image === 'string' ? item.image.trim() : ''
      if (image && !isSafeHttpUrl(image, { allowEmpty: true })) {
        return { ok: false, error: 'slide image must be http(s)' }
      }
      const detailsUrl = typeof item.detailsUrl === 'string' ? item.detailsUrl.trim() : ''
      if (detailsUrl && !isSafeLinkOrPath(detailsUrl, { allowEmpty: true })) {
        return { ok: false, error: 'slide detailsUrl must be /path or http(s) URL' }
      }
      cleaned.push({
        tag: clean(item.tag, 80),
        title: clean(item.title, 200),
        subtitle: clean(item.subtitle, 400),
        accent: clean(item.accent, 200),
        image,
        detailsUrl,
      })
    }
    return { ok: true, value: cleaned }
  },
  homepage_categories(value) {
    if (!Array.isArray(value)) return { ok: false, error: 'homepage_categories must be an array' }
    if (value.length > 30) return { ok: false, error: 'too many categories' }
    const cleaned = []
    for (const item of value) {
      if (!item || typeof item !== 'object') return { ok: false, error: 'each category must be an object' }
      const image = typeof item.image === 'string' ? item.image.trim() : ''
      if (image && !isSafeHttpUrl(image, { allowEmpty: true })) {
        return { ok: false, error: 'category image must be http(s)' }
      }
      const catalogKey = typeof item.catalogKey === 'string' ? item.catalogKey.trim().slice(0, 120) : ''
      if (catalogKey && FORBIDDEN_KEY_CHARS_RE.test(catalogKey)) {
        return { ok: false, error: 'catalogKey contains forbidden characters' }
      }
      cleaned.push({
        catalogKey,
        title: clean(item.title, 100),
        image,
      })
    }
    return { ok: true, value: cleaned }
  },
  homepage_perks(value) {
    if (!Array.isArray(value)) return { ok: false, error: 'homepage_perks must be an array' }
    if (value.length > 30) return { ok: false, error: 'too many perks' }
    const cleaned = []
    for (const item of value) {
      if (!item || typeof item !== 'object') return { ok: false, error: 'each perk must be an object' }
      cleaned.push({
        title: clean(item.title, 120),
        desc: clean(item.desc, 600),
      })
    }
    return { ok: true, value: cleaned }
  },
  search_popular_sections(value) {
    if (!Array.isArray(value)) return { ok: false, error: 'search_popular_sections must be an array' }
    if (value.length > 50) return { ok: false, error: 'too many sections' }
    const cleaned = []
    for (const item of value) {
      if (!item || typeof item !== 'object') return { ok: false, error: 'each section must be an object' }
      const catalogKey = typeof item.catalogKey === 'string' ? item.catalogKey.trim().slice(0, 120) : ''
      if (catalogKey && FORBIDDEN_KEY_CHARS_RE.test(catalogKey)) {
        return { ok: false, error: 'catalogKey contains forbidden characters' }
      }
      cleaned.push({
        label: clean(item.label, 100),
        catalogKey,
      })
    }
    return { ok: true, value: cleaned }
  },
}

export default async function handler(req, res) {
  let supabase
  try {
    supabase = getSupabase()
  } catch {
    return res.status(500).json({ error: 'database not configured' })
  }

  if (req.method === 'GET') {
    const { key } = req.query
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: 'key query param required' })
    }
    if (!ALLOWED_KEYS.has(key)) {
      return res.status(400).json({ error: 'unknown key' })
    }
    const { data, error } = await supabase
      .from('site_content')
      .select('value, updated_at')
      .eq('key', key)
      .single()
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(200).json({ key, value: null, updated_at: null })
      }
      const isTableMissing = error.message.includes('does not exist') || error.code === '42P01'
      if (isTableMissing) return res.status(503).json({ error: 'table_not_found', message: error.message })
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json({ key, value: data?.value ?? null, updated_at: data?.updated_at ?? null })
  }

  if (req.method === 'PUT') {
    if (!isAdminAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })

    const { key, value } = req.body ?? {}
    if (!key || typeof key !== 'string') return res.status(400).json({ error: 'key required' })
    if (!ALLOWED_KEYS.has(key)) return res.status(400).json({ error: 'unknown key' })
    if (value === undefined) return res.status(400).json({ error: 'value required' })

    const validator = VALIDATORS[key]
    if (!validator) return res.status(400).json({ error: 'no validator for key' })
    const result = validator(value)
    if (!result.ok) return res.status(400).json({ error: result.error })

    const { error } = await supabase
      .from('site_content')
      .upsert({ key, value: result.value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
