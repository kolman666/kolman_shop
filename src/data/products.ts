export type Product = {
  id: number
  dbId?: number
  variantGroups?: VariantGroup[]
  slug: string
  brand: string
  price: number
  // Optional "before discount" price for regular products. When set and higher
  // than `price`, the card/product page show it struck through + a sale badge.
  oldPrice?: number
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
  // Used-marketplace fields (Барахолка). Present on admin products that
  // were flipped to the second-hand catalog.
  isUsed?: boolean
  condition?: string
  defects?: string
  originalPrice?: number
}

export type VariantGroup = {
  key: string
  label: string
  name?: string
  options: string[]
}
