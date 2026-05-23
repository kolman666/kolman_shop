import { createClient } from '@supabase/supabase-js'
import { isAdminAuthorized, isSafeHttpUrl, isSafeLinkOrPath } from './_lib/auth.js'
import { writeAuditLog } from './_lib/audit-log.js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

// Localized keys may have an optional _ru / _en suffix; the same validator applies
// to both the bare key and the suffixed variants.
const LOCALIZABLE_BASE_KEYS = new Set([
  'hero_slides',
  'homepage_categories',
  'homepage_perks',
  'homepage_news',
  // Full structured page data — arrays of cards, tiers, services, faq etc.
  // Pages merge this over their i18n defaults.
  'about_data',
  'partnership_data',
  'delivery_data',
  'modding_data',
  'help_choose_data',
  // Site chrome — addresses, hours, top-bar link labels, footer column labels.
  'site_chrome',
  // Brand logos shown in the marquee on the homepage. Each entry has
  // { name, image, url? } — no language variants needed (brand names are
  // global), so this lives outside the localizable-with-suffix set, but we
  // still accept the optional suffix for parity with other ContentTabV2 keys.
  'brand_logos',
])

// Page text content keys: page_<pageId>_<lang>. Validated as a flat object of short strings.
const PAGE_IDS = new Set(['about', 'partnership', 'support', 'help_choose', 'delivery', 'modding', 'used_market'])
const PAGE_KEY_RE = /^page_([a-z_]+)_(ru|en)$/

// Brand-detail pages: arbitrary slug (lowercased letters/digits/hyphen) per
// language. Anything matching this pattern is treated as structured page
// data — same shape as `<page>_data_<lang>` (object of strings + small
// arrays/objects).
const BRAND_KEY_RE = /^brand_data_([a-z0-9-]{1,40})_(ru|en)$/

// Exact-match keys with no language variants.
const EXACT_KEYS = new Set(['search_popular_sections', 'homepage_brand_spotlight'])

// Strip ASCII control characters and clamp length.
const CONTROL_CHARS_RE = new RegExp('[\\u0000-\\u001F\\u007F]', 'g')
function clean(s, max) {
  if (typeof s !== 'string') return ''
  return s.replace(CONTROL_CHARS_RE, '').slice(0, max)
}

// Same as `clean`, but preserves \n and \r — for long-form text fields like
// article bodies where paragraph breaks must survive.
const CONTROL_CHARS_PRESERVE_NL_RE = new RegExp('[\\u0000-\\u0009\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g')
function cleanMultiline(s, max) {
  if (typeof s !== 'string') return ''
  return s.replace(CONTROL_CHARS_PRESERVE_NL_RE, '').slice(0, max)
}

const FORBIDDEN_KEY_CHARS_RE = /[\s"'<>`]/
const LANG_SUFFIX_RE = /_(ru|en)$/

function baseKey(key) {
  return key.replace(LANG_SUFFIX_RE, '')
}

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
  homepage_news(value) {
    if (!Array.isArray(value)) return { ok: false, error: 'homepage_news must be an array' }
    if (value.length > 24) return { ok: false, error: 'too many news items' }
    const cleaned = []
    const seenIds = new Set()
    for (const item of value) {
      if (!item || typeof item !== 'object') return { ok: false, error: 'each news item must be an object' }
      const id = clean(item.id, 80).trim() || `news-${cleaned.length + 1}`
      if (seenIds.has(id)) return { ok: false, error: `duplicate news id: ${id}` }
      seenIds.add(id)
      const image = typeof item.image === 'string' ? item.image.trim() : ''
      if (image && !isSafeHttpUrl(image, { allowEmpty: true })) {
        return { ok: false, error: 'news image must be http(s)' }
      }
      const url = typeof item.url === 'string' ? item.url.trim() : ''
      if (url && !isSafeLinkOrPath(url, { allowEmpty: true })) {
        return { ok: false, error: 'news url must be /path or http(s) URL' }
      }
      cleaned.push({
        id,
        tag: clean(item.tag, 60),
        date: clean(item.date, 60),
        readMin: clean(item.readMin, 40),
        title: clean(item.title, 200),
        excerpt: clean(item.excerpt, 600),
        // Full article body for /news/:id detail pages. Newlines are preserved
        // so paragraphs survive (split on double-newline at render time).
        body: cleanMultiline(item.body, 12000),
        image,
        url,
      })
    }
    return { ok: true, value: cleaned }
  },
  // Generic structured page data: a flat object whose values are sanitized
  // strings, numbers, booleans, or nested arrays/objects of the same. Used for
  // about/partnership/delivery/modding/help_choose `*_data` keys.
  site_chrome(value) { return validateStructuredPage(value) },
  about_data(value) { return validateStructuredPage(value) },
  partnership_data(value) { return validateStructuredPage(value) },
  delivery_data(value) { return validateStructuredPage(value) },
  modding_data(value) { return validateStructuredPage(value) },
  help_choose_data(value) { return validateStructuredPage(value) },

  brand_logos(value) {
    if (!Array.isArray(value)) return { ok: false, error: 'brand_logos must be an array' }
    if (value.length > 40) return { ok: false, error: 'too many brand logos' }
    const cleaned = []
    for (const item of value) {
      if (!item || typeof item !== 'object') return { ok: false, error: 'each brand must be an object' }
      const image = typeof item.image === 'string' ? item.image.trim() : ''
      if (image && !isSafeHttpUrl(image, { allowEmpty: true })) {
        return { ok: false, error: 'brand image must be http(s)' }
      }
      const url = typeof item.url === 'string' ? item.url.trim() : ''
      if (url && !isSafeLinkOrPath(url, { allowEmpty: true })) {
        return { ok: false, error: 'brand url must be /path or http(s)' }
      }
      cleaned.push({
        name: clean(item.name, 80),
        slug: clean(item.slug, 80),
        image,
        url,
      })
    }
    return { ok: true, value: cleaned }
  },

  homepage_brand_spotlight(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'homepage_brand_spotlight must be an object' }
    const bannerImage = typeof value.bannerImage === 'string' ? value.bannerImage.trim() : ''
    if (bannerImage && !isSafeHttpUrl(bannerImage, { allowEmpty: true })) {
      return { ok: false, error: 'bannerImage must be http(s)' }
    }
    const bannerUrl = typeof value.bannerUrl === 'string' ? value.bannerUrl.trim() : ''
    if (bannerUrl && !isSafeLinkOrPath(bannerUrl, { allowEmpty: true })) {
      return { ok: false, error: 'bannerUrl must be /path or http(s) URL' }
    }
    return { ok: true, value: {
      brandSlug: clean(value.brandSlug, 100),
      brandLabel: clean(value.brandLabel, 100),
      bannerImage,
      bannerUrl,
      buttonText: clean(value.buttonText, 100),
    } }
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
  // Page text content: flat object whose values are strings, arrays of strings,
  // or arrays of small string objects (e.g. cards/faq). All strings are cleaned
  // and clamped. Total field count is capped.
  __page(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { ok: false, error: 'page content must be an object' }
    }
    const out = {}
    let total = 0
    for (const [k, raw] of Object.entries(value)) {
      total++
      if (total > 120) return { ok: false, error: 'too many fields' }
      const safeKey = clean(k, 60)
      if (!safeKey || FORBIDDEN_KEY_CHARS_RE.test(safeKey)) {
        return { ok: false, error: `invalid field key: ${k}` }
      }
      out[safeKey] = sanitizePageValue(raw, 0)
      if (out[safeKey] === undefined) {
        return { ok: false, error: `invalid value at ${safeKey}` }
      }
    }
    return { ok: true, value: out }
  },
}

function validateStructuredPage(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, error: 'page data must be an object' }
  }
  const sanitized = sanitizePageValue(value, 0)
  if (sanitized === undefined) return { ok: false, error: 'invalid page data' }
  return { ok: true, value: sanitized }
}

function sanitizePageValue(v, depth) {
  if (depth > 3) return undefined
  if (v === null) return ''
  if (typeof v === 'string') return cleanMultiline(v, 2000)
  if (typeof v === 'number' || typeof v === 'boolean') return v
  if (Array.isArray(v)) {
    if (v.length > 40) return undefined
    const arr = []
    for (const item of v) {
      const x = sanitizePageValue(item, depth + 1)
      if (x === undefined) return undefined
      arr.push(x)
    }
    return arr
  }
  if (typeof v === 'object') {
    const out = {}
    let n = 0
    for (const [k, val] of Object.entries(v)) {
      n++
      if (n > 30) return undefined
      const sk = clean(k, 60)
      if (!sk || FORBIDDEN_KEY_CHARS_RE.test(sk)) return undefined
      const x = sanitizePageValue(val, depth + 1)
      if (x === undefined) return undefined
      out[sk] = x
    }
    return out
  }
  return undefined
}

function getValidator(key) {
  if (EXACT_KEYS.has(key)) return VALIDATORS[key]
  const base = baseKey(key)
  if (LOCALIZABLE_BASE_KEYS.has(base)) return VALIDATORS[base]
  const pageMatch = PAGE_KEY_RE.exec(key)
  if (pageMatch && PAGE_IDS.has(pageMatch[1])) return VALIDATORS.__page
  // Brand detail pages — any slug. Validated with the same generic page
  // sanitiser so admins can add brands without code changes.
  if (BRAND_KEY_RE.test(key)) return VALIDATORS.__page
  return null
}

function isAllowedKey(key) {
  if (typeof key !== 'string') return false
  if (key.length > 80) return false
  if (FORBIDDEN_KEY_CHARS_RE.test(key)) return false
  return getValidator(key) !== null
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
    if (!isAllowedKey(key)) {
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
    if (!isAllowedKey(key)) return res.status(400).json({ error: 'unknown key' })
    if (value === undefined) return res.status(400).json({ error: 'value required' })

    const validator = getValidator(key)
    if (!validator) return res.status(400).json({ error: 'no validator for key' })
    const result = validator(value)
    if (!result.ok) return res.status(400).json({ error: result.error })

    const { error } = await supabase
      .from('site_content')
      .upsert({ key, value: result.value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

    if (error) return res.status(500).json({ error: error.message })
    await writeAuditLog(supabase, req, {
      action: 'content.update',
      entity: 'site_content',
      entity_id: key,
      summary: `Сохранён контент: ${key}`,
    })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
