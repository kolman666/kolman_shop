import { createClient } from '@supabase/supabase-js'
import { isAdminAuthorized, isSafeHttpUrl } from './_lib/auth.js'
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

function slugify(brand, title) {
  return [brand, title]
    .join('-')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 64)
}

const VALID_AVAILABILITY = ['inStock', 'preorder']

function validateProductFields(fields) {
  const { brand, title, price, availability, image, gallery, specs, quantity, variant_groups } = fields

  if (brand !== undefined) {
    if (typeof brand !== 'string' || brand.trim().length === 0 || brand.length > 100) {
      return 'brand must be a non-empty string (max 100 chars)'
    }
  }
  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim().length === 0 || title.length > 200) {
      return 'title must be a non-empty string (max 200 chars)'
    }
  }
  if (price !== undefined) {
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > 10_000_000) {
      return 'price must be a non-negative finite number (max 10,000,000)'
    }
  }
  if (fields.old_price !== undefined && fields.old_price !== null) {
    const op = fields.old_price
    if (typeof op !== 'number' || !Number.isFinite(op) || op < 0 || op > 10_000_000) {
      return 'old_price must be a non-negative finite number (max 10,000,000)'
    }
  }
  if (availability !== undefined && !VALID_AVAILABILITY.includes(availability)) {
    return `availability must be one of: ${VALID_AVAILABILITY.join(', ')}`
  }
  if (image !== undefined && image !== null) {
    if (typeof image !== 'string') return 'image must be a string URL'
    if (!isSafeHttpUrl(image, { allowEmpty: true })) {
      return 'image must be a valid http(s) URL'
    }
  }
  if (gallery !== undefined) {
    if (!Array.isArray(gallery) || gallery.some((u) => typeof u !== 'string')) {
      return 'gallery must be an array of strings'
    }
    if (gallery.length > 20) return 'gallery cannot exceed 20 items'
    for (const u of gallery) {
      if (!isSafeHttpUrl(u, { allowEmpty: true })) {
        return 'gallery URLs must be http(s)'
      }
    }
  }
  if (specs !== undefined) {
    if (!Array.isArray(specs) || specs.some((s) => typeof s !== 'string')) {
      return 'specs must be an array of strings'
    }
    if (specs.length > 50) return 'specs cannot exceed 50 items'
  }
  if (quantity !== undefined) {
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 0) {
      return 'quantity must be a non-negative integer'
    }
  }
  if (variant_groups !== undefined) {
    if (!Array.isArray(variant_groups)) return 'variant_groups must be an array'
    if (variant_groups.length > 20) return 'variant_groups cannot exceed 20 groups'
    for (const group of variant_groups) {
      if (!group || typeof group !== 'object') return 'each variant group must be an object'
      const key = typeof group.key === 'string' ? group.key.trim() : ''
      const label = typeof group.label === 'string' ? group.label.trim() : ''
      const legacyName = typeof group.name === 'string' ? group.name.trim() : ''
      if (!key && !legacyName) {
        return 'each variant group must have a non-empty key'
      }
      if (key && key.length > 80) {
        return 'variant group key must be max 80 chars'
      }
      if (label && label.length > 120) {
        return 'variant group label must be max 120 chars'
      }
      if (!Array.isArray(group.options) || group.options.some((o) => typeof o !== 'string' || !o.trim())) {
        return 'each variant group must contain a non-empty options array of strings'
      }
      if (group.options.length > 50) return 'variant options per group cannot exceed 50 items'
    }
  }
  return null
}

function normalizeVariantGroups(variantGroups) {
  if (!Array.isArray(variantGroups)) return []
  const normalized = []
  for (const group of variantGroups) {
    if (!group || typeof group !== 'object') continue
    const keySource = typeof group.key === 'string' && group.key.trim()
      ? group.key
      : (typeof group.name === 'string' ? group.name : '')
    const key = keySource.trim().toLowerCase().replace(/\s+/g, '_')
    const label = (typeof group.label === 'string' && group.label.trim())
      ? group.label.trim()
      : (typeof group.name === 'string' && group.name.trim() ? group.name.trim() : key)
    const options = []
    if (Array.isArray(group.options)) {
      for (const option of group.options) {
        if (typeof option !== 'string') continue
        const trimmed = option.trim()
        if (trimmed) options.push(trimmed)
      }
    }
    if (key && options.length > 0) {
      normalized.push({ key, label, options })
    }
  }
  return normalized
}

export default async function handler(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  let supabase
  try {
    supabase = getSupabase()
  } catch {
    return res.status(500).json({ error: 'database not configured' })
  }

  // CREATE
  if (req.method === 'POST') {
    const {
      brand, title, description, price, image, gallery, availability, category_key, specs, variant_groups, is_featured, quantity,
      // "Before discount" price for regular products.
      old_price,
      // Used-marketplace fields. is_used flips the product into the
      // /used catalog; the rest describe the second-hand condition.
      is_used, condition, defects, original_price,
    } = req.body ?? {}

    if (!brand || !title || price === undefined) {
      return res.status(400).json({ error: 'brand, title, and price are required' })
    }

    const validationError = validateProductFields({ brand, title, price, old_price, availability, image, gallery, specs, quantity, variant_groups })
    if (validationError) return res.status(400).json({ error: validationError })
    const normalizedVariantGroups = normalizeVariantGroups(variant_groups)

    const slug = slugify(brand ?? '', title ?? '') + '-' + Date.now()

    const insertRow = {
      slug,
      brand,
      title,
      description,
      price,
      image,
      gallery: gallery ?? [],
      availability,
      category_key,
      specs: specs ?? [],
      variant_groups: normalizedVariantGroups,
      is_featured: is_featured ?? false,
      quantity: quantity ?? 0,
      // Optional sale "old price" — only set when a valid number is provided.
      ...(typeof old_price === 'number' && Number.isFinite(old_price) ? { old_price } : {}),
      // Optional used-marketplace fields — only set when admin opted in.
      ...(is_used !== undefined ? { is_used: !!is_used } : {}),
      ...(typeof condition === 'string' ? { condition: condition.slice(0, 80) } : {}),
      ...(typeof defects === 'string' ? { defects: defects.slice(0, 600) } : {}),
      ...(typeof original_price === 'number' && Number.isFinite(original_price)
        ? { original_price }
        : {}),
    }

    let { data, error } = await supabase
      .from('admin_products')
      .insert([insertRow])
      .select()
      .single()

    // Pre-migration deployments may not have the new columns yet — retry
    // without them so existing shops keep accepting products.
    if (error && /is_used|condition|defects|original_price|old_price/i.test(error.message)) {
      const fallback = { ...insertRow }
      delete fallback.is_used
      delete fallback.condition
      delete fallback.defects
      delete fallback.original_price
      delete fallback.old_price
      const retry = await supabase.from('admin_products').insert([fallback]).select().single()
      data = retry.data
      error = retry.error
    }

    if (error) return res.status(500).json({ error: error.message })
    await writeAuditLog(supabase, req, {
      action: 'product.create',
      entity: 'product',
      entity_id: String(data?.id ?? ''),
      summary: `Создан товар: ${data?.brand ?? ''} ${data?.title ?? ''}`.trim(),
      meta: { price: data?.price, slug: data?.slug },
    })
    return res.status(201).json(data)
  }

  // UPDATE
  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body ?? {}
    if (!id || typeof id !== 'number') return res.status(400).json({ error: 'missing or invalid id' })

    const allowedFields = ['brand', 'title', 'description', 'price', 'old_price', 'image', 'gallery', 'availability', 'category_key', 'specs', 'variant_groups', 'is_featured', 'quantity', 'is_used', 'condition', 'defects', 'original_price']
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => allowedFields.includes(k))
    )

    if (Object.keys(safeUpdates).length === 0) {
      return res.status(400).json({ error: 'no valid fields to update' })
    }

    const validationError = validateProductFields(safeUpdates)
    if (validationError) return res.status(400).json({ error: validationError })
    if (safeUpdates.variant_groups !== undefined) {
      safeUpdates.variant_groups = normalizeVariantGroups(safeUpdates.variant_groups)
    }

    // Snapshot the row before update so we can compute a real field-level
    // diff for the audit log ("цена: 1 200 → 1 490; quantity: 5 → 3").
    const beforeRes = await supabase.from('admin_products').select('*').eq('id', id).maybeSingle()
    const before = beforeRes.data ?? {}

    const { data, error } = await supabase
      .from('admin_products')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Russian aliases so the audit timeline reads like a human wrote it,
    // not like a column dump.
    const PRODUCT_ALIASES = {
      brand: 'бренд',
      title: 'название',
      description: 'описание',
      price: 'цена',
      old_price: 'цена до скидки',
      image: 'главное фото',
      gallery: 'галерея',
      availability: 'статус',
      category_key: 'категория',
      specs: 'характеристики',
      variant_groups: 'вариативности',
      is_featured: 'рекомендуемый',
      quantity: 'кол-во в наличии',
      is_used: 'б/у',
      condition: 'состояние',
      defects: 'дефекты',
      original_price: 'цена нового',
    }
    const changes = diffRecords(before, data, {
      fields: Object.keys(safeUpdates),
      aliases: PRODUCT_ALIASES,
    })
    await writeAuditLog(supabase, req, {
      action: 'product.update',
      entity: 'product',
      entity_id: String(id),
      // Let the helper build the summary from `changes`.
      summary: changes.length === 0
        ? `Товар #${id} сохранён без изменений`
        : `Изменён товар #${id} «${data?.title ?? ''}»`,
      meta: { product_title: data?.title, product_brand: data?.brand },
      changes,
    })
    return res.status(200).json(data)
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {}
    if (!id || typeof id !== 'number') return res.status(400).json({ error: 'missing or invalid id' })

    // Capture the row before we drop it so the audit summary shows what was
    // killed: brand + title + price. Otherwise admin sees an opaque "#42".
    const snap = await supabase.from('admin_products').select('brand, title, price').eq('id', id).maybeSingle()
    const { error } = await supabase.from('admin_products').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    const label = snap.data
      ? `${snap.data.brand ?? ''} ${snap.data.title ?? ''}`.trim() || `#${id}`
      : `#${id}`
    await writeAuditLog(supabase, req, {
      action: 'product.delete',
      entity: 'product',
      entity_id: String(id),
      summary: `Удалён товар: ${label}${snap.data?.price ? ` (${snap.data.price} ₽)` : ''}`,
      meta: snap.data ?? {},
    })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
