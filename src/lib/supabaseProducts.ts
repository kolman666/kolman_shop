import { supabase } from './supabase'
import type { Product } from '../data/products'

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
  is_featured: boolean
  quantity: number
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
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
    isFeatured: row.is_featured,
    quantity: row.quantity,
    isAdminCreated: true,
  }
}

export async function fetchSupabaseProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('admin_products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error || !data) return []
  return (data as ProductRow[]).map(rowToProduct)
}
