#!/usr/bin/env node
// Generates migrations/seed_content.sql from the i18n locale files so admin
// users start with all default content in Supabase (both RU and EN). Re-run
// any time the locale defaults change.
//
//   node scripts/generate-seed-sql.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadLocale(file) {
  // Strip `const ru = {` ... `} as const` ... `export default ru` and eval the
  // resulting object literal. The locale files are intentionally pure data so
  // this works without a TS compiler.
  const raw = readFileSync(resolve(root, 'src/locales', file), 'utf8')
  // Grab everything between the first `=` after `const <name> =` and the
  // matching ` as const` token.
  const start = raw.indexOf('= {')
  const asConst = raw.indexOf('} as const')
  if (start < 0 || asConst < 0) throw new Error(`Cannot parse locale ${file}`)
  const literal = raw.slice(start + 2, asConst + 1) // include outer braces
  // eslint-disable-next-line no-new-func
  return new Function(`return (${literal})`)()
}

const ru = loadLocale('ru.ts')
const en = loadLocale('en.ts')

const sampleNewsRu = [
  {
    id: 'fenrir',
    tag: 'обзоры',
    readMin: '5 мин чтения',
    title: 'удивительная малютка G-Wolves Fenrir Asym',
    excerpt:
      'сегодня мы подробно разберем игровую мышь G-Wolves Fenrir Asym. она была создана строго для одной цели — использования пальцевым хватом (fingertip grip).',
    body:
      'g-wolves fenrir asym — это специализированная мышь под fingertip grip.\n\nна тестах она показывает себя как лёгкая и манёвренная — 49 грамм веса, мягкий клик, paw3950 внутри.\n\nдля palm/claw она подойдёт хуже из-за крайне низкого профиля.',
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=1200&q=80',
    url: '/catalog',
  },
  {
    id: 'zywoo',
    tag: 'обзоры',
    readMin: '4 мин чтения',
    title: 'ZywOo x Pulsar: «оружие избранного»',
    excerpt:
      'компания pulsar совместно с главной звездой CS2 матье «zywoo» эрбо выпустили именную мышь. это не просто девайс с логотипом, а инструмент.',
    body:
      'pulsar x9 zywoo edition — это форма xlite v3 с отдельной прошивкой и кейкомпом, тюнингованным под профессиональную руку.\n\nцена дороже базовой версии, но в комплекте идут уникальные глайды и pvc-наклейки.',
    image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=1200&q=80',
    url: '/catalog',
  },
  {
    id: 'modding',
    tag: 'гайды',
    readMin: '7 мин чтения',
    title: 'смазка свитчей: с чего начать новичку',
    excerpt: 'выбираем смазку под свой кейкорд, разбираем порядок работ и показываем разницу до и после.',
    body:
      'для линейных свитчей берите krytox 205g0 — золотой стандарт.\n\nдля тактильных — что-то посуше: 3203 или вообще без смазки на ножке.\n\nпорядок: разбор → смазка стебля и пружины → сборка → тест.',
    image: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=1200&q=80',
    url: '/modding',
  },
]

const sampleNewsEn = [
  {
    id: 'fenrir',
    tag: 'reviews',
    readMin: '5 min read',
    title: 'The tiny G-Wolves Fenrir Asym',
    excerpt:
      'A deep dive into the G-Wolves Fenrir Asym — a mouse built specifically for fingertip grip.',
    body:
      'g-wolves fenrir asym is a specialized fingertip mouse.\n\nin testing it feels light and snappy — 49g weight, soft click, paw3950 inside.\n\nnot great for palm/claw because of the extremely low profile.',
    image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=1200&q=80',
    url: '/catalog',
  },
  {
    id: 'zywoo',
    tag: 'reviews',
    readMin: '4 min read',
    title: 'ZywOo x Pulsar: weapon of the chosen',
    excerpt:
      "Pulsar teamed up with CS2's top player Mathieu 'ZywOo' Herbaut to release a signature mouse — not just a logo product.",
    body:
      'pulsar x9 zywoo edition uses the xlite v3 shape with a custom firmware and weight balance tuned for a pro hand.\n\npricier than the base version but comes with unique glides and pvc stickers.',
    image: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=1200&q=80',
    url: '/catalog',
  },
  {
    id: 'modding',
    tag: 'guides',
    readMin: '7 min read',
    title: 'Switch lubing 101 for beginners',
    excerpt: 'How to pick the right lube, the basic workflow, and the before/after on popular switches.',
    body:
      'for linear switches use krytox 205g0 — the gold standard.\n\nfor tactiles go drier: 3203 or no lube on the leg.\n\nworkflow: disassemble → lube stem and spring → reassemble → test.',
    image: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=1200&q=80',
    url: '/modding',
  },
]

const CATEGORY_KEYS = [
  'products.categories.mice',
  'products.categories.mousepads',
  'products.categories.keyboards',
  'products.categories.headsets',
  'products.categories.glides',
  'products.categories.accessories',
]
const CATEGORY_IMAGES = [
  'https://polzarium.ru/content/images/2025/05/0-7.jpg',
  'https://ae01.alicdn.com/kf/Sdf5307d2047f4386b59dde83ff7df080r.png',
  'https://iqunix.com/cdn/shop/files/07_ef9ac2e6-4b41-471b-af02-4b537819110b.jpg?v=1765951802&width=1946',
  'https://i.ytimg.com/vi/AbOziOlBiMk/maxresdefault.jpg',
  'https://www.deltamechanics.ru/pictures/product/big/20100_big.jpg',
  'https://fbi.cults3d.com/uploaders/14107503/illustration-file/1080cada-90f7-4eef-a8fe-a112bfde6460/cyberpunk_edgerunners_keycaps_04.jpg',
]
const SLIDE_IMAGES = [
  'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=1400&q=80',
  'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=1400&q=80',
  'https://images.unsplash.com/photo-1563297007-0686b7003af7?w=1400&q=80',
]

function heroSlides(lng) {
  const src = lng.slides
  return src.map((s, i) => ({
    tag: s.tag,
    title: s.title,
    subtitle: s.subtitle,
    accent: s.accent,
    image: SLIDE_IMAGES[i] ?? '',
    detailsUrl: '',
  }))
}

function homepageCategories(lng) {
  const titles = lng.categories
  return titles.map((title, i) => ({
    catalogKey: CATEGORY_KEYS[i] ?? '',
    title,
    image: CATEGORY_IMAGES[i] ?? '',
  }))
}

function homepagePerks(lng) {
  return lng.perks.map((p) => ({ title: p.title, desc: p.desc }))
}

function aboutData(lng) {
  const a = lng.about
  return {
    eyebrow: a.eyebrow,
    title: a.title,
    subtitle: a.subtitle,
    heroPrimary: a.heroPrimary,
    heroSecondary: a.heroSecondary,
    polaroidTag: a.polaroidTag,
    polaroidTitle: a.polaroidTitle,
    storyTitle: a.storyTitle,
    storyText: a.storyText,
    valuesTitle: a.valuesTitle,
    contactLabel: a.contactLabel,
    contactTitle: a.contactTitle,
    contactText: a.contactText,
    avitoBtn: a.avitoBtn,
    emailBtn: a.emailBtn,
    stats: a.stats,
    timeline: a.timeline,
    values: a.values,
  }
}

function partnershipData(lng) {
  const p = lng.partnership
  return {
    eyebrow: p.eyebrow,
    title: p.title,
    subtitle: p.subtitle,
    popularBadge: p.popularBadge,
    tierCtaPrimary: p.tierCtaPrimary,
    tierCtaSecondary: p.tierCtaSecondary,
    perksTitle: p.perksTitle,
    ctaLabel: p.ctaLabel,
    ctaText: p.ctaText,
    telegramBtn: p.telegramBtn,
    emailBtn: p.emailBtn,
    tiers: p.tiers,
    perks: p.perks,
  }
}

function deliveryData(lng) {
  const d = lng.delivery
  return {
    eyebrow: d.eyebrow,
    title: d.title,
    subtitle: d.subtitle,
    statusChip: d.statusChip,
    timelineTitle: d.timelineTitle,
    paymentTitle: d.paymentTitle,
    coverageTitle: d.coverageTitle,
    faqTitle: d.faqTitle,
    timeline: d.timeline,
    payment: d.payment,
    coverage: d.coverage,
    faq: d.faq,
  }
}

function moddingData(lng) {
  const m = lng.modding
  return {
    eyebrow: m.eyebrow,
    titleStart: m.titleStart,
    titleAccent: m.titleAccent,
    titleEnd: m.titleEnd,
    subtitle: m.subtitle,
    processTitle: m.processTitle,
    bundlesTitle: m.bundlesTitle,
    bundlesSubtitle: m.bundlesSubtitle,
    perks: m.perks,
    processSteps: m.processSteps,
    services: m.services,
    bundles: m.bundles,
    finalCtaTitle: m.finalCta?.title,
    finalCtaText: m.finalCta?.text,
    finalCtaBtn: m.finalCta?.btn,
  }
}

function helpChooseData(lng) {
  const h = lng.helpChoose
  return {
    eyebrow: h.eyebrow,
    title: h.title,
    subtitle: h.subtitle,
    resultTitle: h.resultTitle,
    resultText: h.resultText,
    resetBtn: h.resetBtn,
    telegramBtn: h.telegramBtn,
    supportBtn: h.supportBtn,
    steps: h.steps,
  }
}

function escapeSqlJson(value) {
  // Postgres JSONB single-quoted string with `''` escaped.
  return JSON.stringify(value).replace(/'/g, "''")
}

function upsert(key, value) {
  return `INSERT INTO site_content (key, value, updated_at) VALUES ('${key}', '${escapeSqlJson(
    value,
  )}'::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`
}

const lines = []
lines.push('-- Seed default content (RU + EN) into site_content.')
lines.push('-- Generated by scripts/generate-seed-sql.mjs from src/locales/{ru,en}.ts.')
lines.push('-- Safe to re-run: each row is upserted by key.')
lines.push('')
lines.push('-- Hero slides')
lines.push(upsert('hero_slides_ru', heroSlides(ru)))
lines.push(upsert('hero_slides_en', heroSlides(en)))
lines.push('')
lines.push('-- Categories')
lines.push(upsert('homepage_categories_ru', homepageCategories(ru)))
lines.push(upsert('homepage_categories_en', homepageCategories(en)))
lines.push('')
lines.push('-- Perks')
lines.push(upsert('homepage_perks_ru', homepagePerks(ru)))
lines.push(upsert('homepage_perks_en', homepagePerks(en)))
lines.push('')
lines.push('-- News (sample articles — feel free to edit in admin afterwards)')
lines.push(upsert('homepage_news_ru', sampleNewsRu))
lines.push(upsert('homepage_news_en', sampleNewsEn))
lines.push('')
lines.push('-- About page')
lines.push(upsert('about_data_ru', aboutData(ru)))
lines.push(upsert('about_data_en', aboutData(en)))
lines.push('')
lines.push('-- Partnership page')
lines.push(upsert('partnership_data_ru', partnershipData(ru)))
lines.push(upsert('partnership_data_en', partnershipData(en)))
lines.push('')
lines.push('-- Delivery page')
lines.push(upsert('delivery_data_ru', deliveryData(ru)))
lines.push(upsert('delivery_data_en', deliveryData(en)))
lines.push('')
lines.push('-- Modding page')
lines.push(upsert('modding_data_ru', moddingData(ru)))
lines.push(upsert('modding_data_en', moddingData(en)))
lines.push('')
lines.push('-- Help-choose page')
lines.push(upsert('help_choose_data_ru', helpChooseData(ru)))
lines.push(upsert('help_choose_data_en', helpChooseData(en)))
lines.push('')

const out = resolve(root, 'migrations/seed_content.sql')
writeFileSync(out, lines.join('\n'))
console.log(`Wrote ${out} (${lines.length} statements)`)
