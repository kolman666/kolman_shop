import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const hasSupabaseEnv = Boolean(url && key)

if (!hasSupabaseEnv) {
  console.warn('[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Falling back to static catalog only.')
}

export const supabase = hasSupabaseEnv ? createClient(url, key) : null
