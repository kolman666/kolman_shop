import { supabase } from './supabase'
import type { Product, VariantGroup } from '../data/products'

const SUPABASE_ID_OFFSET = 1_000_000

export type ProductRow = {
  id: number
  slug: string
  brand: string
  title: string
  description: string
  price: number
  image: string
  gallery: string[]
  availability: 'inStock' | 'preorder'
  category_key: string
  specs: string[]
  variant_groups?: VariantGroup[]
  is_featured: boolean
  quantity: number
}

export function rowToProduct(row: ProductRow): Product {
  return {
    // Keep client-side ids unique to avoid collisions with static catalog ids.
    id: SUPABASE_ID_OFFSET + row.id,
    dbId: row.id,
    slug: row.slug,
    brand: row.brand,
    price: row.price,
    image: row.image,
    gallery: (row.gallery as unknown as string[]) ?? [],
    availability: row.availability,
    categoryKey: row.category_key,
    titleKey: 'admin.placeholder.title',
    titleDirect: row.title,
    descriptionKey: 'admin.placeholder.description',
    descriptionDirect: row.description,
    specs: (row.specs as unknown as string[]) ?? [],
    variantGroups: (row.variant_groups as unknown as VariantGroup[]) ?? [],
    isFeatured: row.is_featured,
    quantity: row.quantity,
    isAdminCreated: true,
  }
}

export async function fetchSupabaseProducts(): Promise<Product[]> {
  if (!supabase) return []

  const { data, error } = await supabase
    .from('admin_products')
    .select('*')
    .order('id', { ascending: false })

  if (error) {
    console.error('[supabase] fetch admin_products failed:', error.message, error)
    return []
  }

  if (!data) return []

  return (data as ProductRow[]).map(rowToProduct)
}
