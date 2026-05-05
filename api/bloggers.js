import { createClient } from '@supabase/supabase-js'
import { isAdminAuthorized, isSafeHttpUrl } from './_lib/auth.js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

function isAuthorized(req) {
  return isAdminAuthorized(req)
}

const ALLOWED_UPDATE_FIELDS = ['name', 'description', 'image', 'social_url', 'gear_product_ids', 'is_active', 'sort_order']

function validateBlogger(fields) {
  const { name, description, image, social_url, gear_product_ids, sort_order } = fields
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0 || name.length > 120)) {
    return 'name must be a non-empty string (max 120 chars)'
  }
  if (description !== undefined && (typeof description !== 'string' || description.length > 500)) {
    return 'description must be a string (max 500 chars)'
  }
  if (image !== undefined) {
    if (typeof image !== 'string') return 'image must be a string'
    if (!isSafeHttpUrl(image, { allowEmpty: true })) return 'image must be a valid http(s) URL'
  }
  if (social_url !== undefined) {
    if (typeof social_url !== 'string') return 'social_url must be a string'
    if (!isSafeHttpUrl(social_url, { allowEmpty: true })) return 'social_url must be a valid http(s) URL'
  }
  if (gear_product_ids !== undefined) {
    if (!Array.isArray(gear_product_ids) || gear_product_ids.some((id) => typeof id !== 'number' || !Number.isInteger(id))) {
      return 'gear_product_ids must be an array of integers'
    }
  }
  if (sort_order !== undefined && (typeof sort_order !== 'number' || !Number.isInteger(sort_order))) {
    return 'sort_order must be an integer'
  }
  return null
}

export default async function handler(req, res) {
  let supabase
  try {
    supabase = getSupabase()
  } catch {
    return res.status(500).json({ error: 'database not configured' })
  }

  // GET — public read
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('bloggers')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) {
      const isTableMissing = error.message.includes('does not exist') || error.code === '42P01'
      if (isTableMissing) return res.status(503).json({ error: 'table_not_found', message: error.message })
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json(data ?? [])
  }

  if (!isAuthorized(req)) return res.status(401).json({ error: 'unauthorized' })

  // POST — create
  if (req.method === 'POST') {
    const { name, description = '', image = '', social_url = '', gear_product_ids = [], is_active = true, sort_order = 0 } = req.body ?? {}
    if (!name) return res.status(400).json({ error: 'name is required' })
    const validationError = validateBlogger({ name, description, image, social_url, gear_product_ids, sort_order })
    if (validationError) return res.status(400).json({ error: validationError })

    const { data, error } = await supabase
      .from('bloggers')
      .insert([{ name: name.trim(), description, image, social_url, gear_product_ids, is_active, sort_order }])
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // PATCH — update
  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body ?? {}
    if (!id || typeof id !== 'number') return res.status(400).json({ error: 'missing or invalid id' })

    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([k]) => ALLOWED_UPDATE_FIELDS.includes(k))
    )
    if (Object.keys(safeUpdates).length === 0) return res.status(400).json({ error: 'no valid fields to update' })

    const validationError = validateBlogger(safeUpdates)
    if (validationError) return res.status(400).json({ error: validationError })

    const { data, error } = await supabase
      .from('bloggers')
      .update(safeUpdates)
      .eq('id', id)
      .select()
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { id } = req.body ?? {}
    if (!id || typeof id !== 'number') return res.status(400).json({ error: 'missing or invalid id' })
    const { error } = await supabase.from('bloggers').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  return res.status(405).json({ error: 'method not allowed' })
}
