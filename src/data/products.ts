export type Product = {
  id: number
  dbId?: number
  variantGroups?: VariantGroup[]
  slug: string
  brand: string
  price: number
  image: string
  gallery?: string[]
  availability: 'inStock' | 'preorder'
  categoryKey: string
  titleKey: string
  descriptionKey: string
  tagKey?: string
  specs?: string[]
  isFeatured?: boolean
  // Admin-created product fields
  titleDirect?: string
  descriptionDirect?: string
  quantity?: number
  isAdminCreated?: boolean
}

export type VariantGroup = {
  name: string
  options: string[]
}

export const products: Product[] = [
]
