export type Product = {
  id: number
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

export const products: Product[] = [
  {
    id: 1,
    slug: 'wlmouse-beast-x-pro',
    brand: 'WLMOUSE',
    price: 13990,
    image: 'https://preview.redd.it/wlmouse-beast-x-review-after-1-month-v0-huaiyz9hhfqc1.jpg?width=1280&format=pjpg&auto=webp&s=67cf4b53316317dc580f7f36b54187bb3b1073dd',
    gallery: [
      'https://preview.redd.it/wlmouse-beast-x-review-after-1-month-v0-huaiyz9hhfqc1.jpg?width=1280&format=pjpg&auto=webp&s=67cf4b53316317dc580f7f36b54187bb3b1073dd',
      'https://i.redd.it/9pex6i5n4arc1.jpeg',
      'https://i.redd.it/khtj0ifn4arc1.jpeg',
    ],
    availability: 'inStock',
    categoryKey: 'products.categories.mice',
    titleKey: 'products.wlmouseBeastX.title',
    descriptionKey: 'products.wlmouseBeastX.description',
    tagKey: 'products.wlmouseBeastX.tag',
    specs: ['39g', 'PAW3395', '8K hz'],
    isFeatured: true,
  },
  {
    id: 2,
    slug: 'cidoo-qk75',
    brand: 'CIDOO',
    price: 3490,
    image: 'https://cidootech.com/cdn/shop/files/CIDOO_QK75_QMK_09_d09d871f-edc0-4c7f-8a1e-2f95447ef3ed.png?v=1766652496',
    gallery: [
      'https://cidootech.com/cdn/shop/files/CIDOO_QK75_QMK_09_d09d871f-edc0-4c7f-8a1e-2f95447ef3ed.png?v=1766652496',
      'https://cidootech.com/cdn/shop/files/CIDOO_QK75_QMK_04_6477a3ec-8f42-4694-86cd-b343f547ea0f.png?v=1766652496',
      'https://cidootech.com/cdn/shop/files/CIDOO_QK75_QMK_07_20fe67f5-a88f-4f92-9e77-724950753a89.png?v=1766652496',
    ],
    availability: 'inStock',
    categoryKey: 'products.categories.keyboards',
    titleKey: 'products.cidooQK75.title',
    descriptionKey: 'products.cidooQK75.description',
    tagKey: 'products.cidooQK75.tag',
    specs: ['75%', 'Cidoo Pearl', 'RGB lighting'],
    isFeatured: true,
  },
  {
    id: 3,
    slug: 'lamzu-maya-x',
    brand: 'LAMZU',
    price: 8990,
    image: 'https://lamzu.com/cdn/shop/files/1_659dd1e0-544c-49d0-8ab7-2af96f8f7150.jpg?v=1720696807&width=1600',
    gallery: [
      'https://lamzu.com/cdn/shop/files/1_659dd1e0-544c-49d0-8ab7-2af96f8f7150.jpg?v=1720696807&width=1600',
      'https://lamzu.com/cdn/shop/files/4_b9f463c8-b5c2-4d8f-b3dc-95d47ca0f0c8.jpg?v=1720696807&width=1600',
      'https://lamzu.com/cdn/shop/files/3_9f5cfca5-0bb9-43c1-b5d4-f0f15be0f2a2.jpg?v=1720696807&width=1600',
    ],
    availability: 'preorder',
    categoryKey: 'products.categories.mice',
    titleKey: 'products.lamzuMayaX.title',
    descriptionKey: 'products.lamzuMayaX.description',
    tagKey: 'products.lamzuMayaX.tag',
    specs: ['47g', 'Nordic MCU', 'PixArt 3950'],
    isFeatured: false,
  },
  {
    id: 4,
    slug: 'iqunix-ez63',
    brand: 'IQUNIX',
    price: 12990,
    image: 'https://iqunix.com/cdn/shop/files/07_ef9ac2e6-4b41-471b-af02-4b537819110b.jpg?v=1765951802&width=1946',
    gallery: [
      'https://iqunix.com/cdn/shop/files/07_ef9ac2e6-4b41-471b-af02-4b537819110b.jpg?v=1765951802&width=1946',
      'https://iqunix.com/cdn/shop/files/05_7f519f26-771a-4c8f-bf5f-f23b6b7a5a40.jpg?v=1765951802&width=1946',
      'https://iqunix.com/cdn/shop/files/02_6aa809fd-49c6-4bf3-abfb-2f00f45f8f8f.jpg?v=1765951802&width=1946',
    ],
    availability: 'preorder',
    categoryKey: 'products.categories.keyboards',
    titleKey: 'products.iqunixEz63.title',
    descriptionKey: 'products.iqunixEz63.description',
    tagKey: 'products.iqunixEz63.tag',
    specs: ['65%', 'Hall effect', 'Rapid trigger'],
    isFeatured: false,
  },
  {
    id: 5,
    slug: 'pulsar-paracontrol-v2',
    brand: 'PULSAR',
    price: 2590,
    image: 'https://ausmodshop.com/cdn/shop/files/New_Project_129.jpg?v=1748658219&width=1400',
    gallery: [
      'https://ausmodshop.com/cdn/shop/files/New_Project_129.jpg?v=1748658219&width=1400',
      'https://ausmodshop.com/cdn/shop/files/New_Project_130.jpg?v=1748658219&width=1400',
    ],
    availability: 'inStock',
    categoryKey: 'products.categories.mousepads',
    titleKey: 'products.pulsarParacontrol.title',
    descriptionKey: 'products.pulsarParacontrol.description',
    tagKey: 'products.pulsarParacontrol.tag',
    specs: ['XL', 'control surface', 'stitched edge'],
    isFeatured: false,
  },
  {
    id: 6,
    slug: 'pulsar-supergrip-kit',
    brand: 'PULSAR',
    price: 990,
    image: 'https://www.deltamechanics.ru/pictures/product/big/20100_big.jpg',
    gallery: [
      'https://www.deltamechanics.ru/pictures/product/big/20100_big.jpg',
      'https://www.deltamechanics.ru/pictures/product/big/20101_big.jpg',
    ],
    availability: 'inStock',
    categoryKey: 'products.categories.accessories',
    titleKey: 'products.pulsarSupergrip.title',
    descriptionKey: 'products.pulsarSupergrip.description',
    tagKey: 'products.pulsarSupergrip.tag',
    specs: ['universal fit', '0.5 mm', 'anti-slip'],
    isFeatured: false,
  },
]
