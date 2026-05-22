import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchSiteContent, updateSiteContent } from '../../lib/siteContent'
import NewsBlock, { type NewsItem } from '../../components/NewsBlock'
import BloggersBlock from '../../components/BloggersBlock'
import { useProducts } from '../../hooks/useProducts'
import { AccordionSection } from './AccordionSection'
import { PreviewModal } from './PreviewModal'
import { ArrayEditor } from './ArrayEditor'

type HeroSlide = { tag: string; title: string; subtitle: string; accent: string; image: string; detailsUrl?: string }
type ContentCategory = { catalogKey: string; title: string; image: string }
type ContentPerk = { title: string; desc: string }
type SearchSectionAdmin = { label: string; catalogKey: string }
type NewsItemAdmin = NewsItem & { body?: string }

const BLANK_SLIDE: HeroSlide = { tag: '', title: '', subtitle: '', accent: '', image: '', detailsUrl: '' }
const BLANK_NEWS: NewsItemAdmin = { id: '', tag: '', date: '', readMin: '', title: '', excerpt: '', body: '', image: '', url: '' }

const CATEGORY_KEYS = [
  'products.categories.mice',
  'products.categories.mousepads',
  'products.categories.keyboards',
  'products.categories.headsets',
  'products.categories.glides',
  'products.categories.accessories',
]
const CATEGORY_KEY_LABELS: Record<string, string> = {
  'products.categories.mice': 'мышки',
  'products.categories.mousepads': 'коврики',
  'products.categories.keyboards': 'клавиатуры',
  'products.categories.headsets': 'наушники',
  'products.categories.glides': 'глайды / грипсы',
  'products.categories.accessories': 'аксессуары',
}

type SiteChrome = {
  address?: string
  workHours?: string
  email?: string
  alwaysAvailable?: string
  topLinks?: string[]
}

type BrandLogo = {
  name: string
  slug?: string
  image: string
  url?: string
}

type HomepageBrandSpotlight = {
  brandSlug: string
  brandLabel: string
  bannerImage: string
  bannerUrl?: string
  buttonText?: string
}

type SectionKey =
  | 'hero_slides'
  | 'homepage_categories'
  | 'homepage_perks'
  | 'homepage_news'
  | 'search_popular_sections'
  | 'site_chrome'
  | 'brand_logos'
  | 'homepage_brand_spotlight'

type State = {
  hero_slides: HeroSlide[]
  homepage_categories: ContentCategory[]
  homepage_perks: ContentPerk[]
  homepage_news: NewsItemAdmin[]
  search_popular_sections: SearchSectionAdmin[]
  site_chrome: SiteChrome
  brand_logos: BrandLogo[]
  homepage_brand_spotlight: HomepageBrandSpotlight
}

const INITIAL: State = {
  hero_slides: [],
  homepage_categories: [],
  homepage_perks: [],
  homepage_news: [],
  search_popular_sections: [],
  site_chrome: {},
  brand_logos: [],
  homepage_brand_spotlight: { brandSlug: 'wlmouse', brandLabel: 'wlmouse', bannerImage: '', bannerUrl: '/brand/wlmouse', buttonText: 'перейти к бренду →' },
}

// Keys that are language-suffixed in storage (`{key}_{lang}`).
const LOCALIZED: SectionKey[] = ['hero_slides', 'homepage_categories', 'homepage_perks', 'homepage_news', 'site_chrome']

function storageKey(section: SectionKey, lang: 'ru' | 'en'): string {
  return LOCALIZED.includes(section) ? `${section}_${lang}` : section
}

export function ContentTabV2() {
  const [lang, setLang] = useState<'ru' | 'en'>('ru')
  const [data, setData] = useState<State>(INITIAL)
  const [dirty, setDirty] = useState<Set<SectionKey>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ title: string; node: ReactNode } | null>(null)

  // Load all sections for the active language.
  useEffect(() => {
    setLoading(true)
    setError('')
    const sections: SectionKey[] = ['hero_slides', 'homepage_categories', 'homepage_perks', 'homepage_news', 'search_popular_sections', 'site_chrome', 'brand_logos', 'homepage_brand_spotlight']
    Promise.all(
      sections.map(async (s) => {
        const key = storageKey(s, lang)
        const result = await fetchSiteContent<unknown>(key)
        if (result.data === null && LOCALIZED.includes(s)) {
          // No language-specific override: try legacy unsuffixed key.
          const legacy = await fetchSiteContent<unknown>(s)
          return [s, legacy.data] as const
        }
        return [s, result.data] as const
      }),
    ).then((entries) => {
      const next: State = { ...INITIAL }
      for (const [s, value] of entries) {
        if (s === 'site_chrome') {
          if (value && typeof value === 'object' && !Array.isArray(value)) next.site_chrome = value as SiteChrome
        } else if (Array.isArray(value)) {
          (next as Record<SectionKey, unknown>)[s] = value
        }
      }
      setData(next)
      setDirty(new Set())
      setLoading(false)
    })
  }, [lang])

  function updateSection<K extends SectionKey>(key: K, value: State[K]) {
    setData((prev) => ({ ...prev, [key]: value }))
    setDirty((prev) => new Set(prev).add(key))
  }

  async function saveAll() {
    if (dirty.size === 0) return
    setSaving(true)
    setError('')
    try {
      const dirtyKeys = Array.from(dirty)
      for (const sec of dirtyKeys) {
        await updateSiteContent(storageKey(sec, lang), data[sec])
      }
      setDirty(new Set())
      setSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin__content-tab">
      <div className="admin__topbar">
        <div className="admin__topbar-left">
          <h2 className="admin__topbar-title">Контент главной страницы</h2>
          <div className="admin__lang-row">
            <span className="admin__label" style={{ margin: 0 }}>Язык:</span>
            <div className="admin__lang-tabs">
              {(['ru', 'en'] as const).map((lng) => (
                <button
                  key={lng}
                  type="button"
                  className={`admin__lang-tab ${lang === lng ? 'admin__lang-tab--active' : ''}`.trim()}
                  onClick={() => setLang(lng)}
                  disabled={dirty.size > 0}
                  title={dirty.size > 0 ? 'Сначала сохраните изменения' : ''}
                >
                  {lng.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="admin__topbar-right">
          <span className="admin__topbar-meta">
            {dirty.size > 0
              ? <>несохранённых блоков: <b>{dirty.size}</b></>
              : savedAt
                ? <>сохранено · {new Date(savedAt).toLocaleTimeString('ru-RU')}</>
                : <>все данные сохранены</>}
          </span>
          {error && <span style={{ color: 'var(--color-main)', fontSize: 13 }}>{error}</span>}
          <button
            type="button"
            className={`admin__save-all ${dirty.size > 0 ? 'admin__save-all--dirty' : ''}`.trim()}
            onClick={() => void saveAll()}
            disabled={saving || dirty.size === 0}
          >
            {saving ? 'Сохраняем...' : 'Сохранить всё'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="admin__content-empty"><p className="admin__empty-text">Загрузка контента...</p></div>
      ) : (
        <div className="admin__accordions">
          <AccordionSection
            title="Главный баннер"
            description="Слайды на главной странице. Можно подменять заголовок, фото и кнопку «подробнее»."
            count={data.hero_slides.length}
            dirty={dirty.has('hero_slides')}
            defaultOpen
            actions={
              <button
                type="button"
                className="accordion__btn"
                onClick={() => setPreview({ title: 'Главный баннер — превью', node: <HeroPreview slides={data.hero_slides} /> })}
              >
                Превью
              </button>
            }
          >
            <ArrayEditor<HeroSlide>
              items={data.hero_slides}
              onChange={(v) => updateSection('hero_slides', v)}
              blank={() => ({ ...BLANK_SLIDE })}
              itemLabel={(i, item) => `Слайд ${i + 1}${item.title ? ` — ${item.title.slice(0, 32)}` : ''}`}
              addLabel="+ Добавить слайд"
              max={10}
              renderItem={(item, _, update) => (
                <>
                  <div className="admin__field-grid-2">
                    <Field label="Тег" value={item.tag} onChange={(v) => update({ tag: v })} placeholder="новинка" />
                    <Field label="Заголовок" value={item.title} onChange={(v) => update({ title: v })} />
                  </div>
                  <Field label="Подзаголовок" value={item.subtitle} onChange={(v) => update({ subtitle: v })} />
                  <Field label="Акцентный текст" value={item.accent} onChange={(v) => update({ accent: v })} />
                  <ImageField label="Фото (URL)" value={item.image} onChange={(v) => update({ image: v })} />
                  <Field
                    label="Ссылка кнопки «Подробнее»"
                    hint="/product/slug, /catalog?category=… или https://…"
                    value={item.detailsUrl ?? ''}
                    onChange={(v) => update({ detailsUrl: v })}
                  />
                </>
              )}
            />
          </AccordionSection>

          <AccordionSection
            title="Категории на главной"
            description="Плитка-сетка категорий, ведёт в каталог с уже выставленным фильтром."
            count={data.homepage_categories.length}
            dirty={dirty.has('homepage_categories')}
            actions={
              <button
                type="button"
                className="accordion__btn"
                onClick={() => setPreview({ title: 'Категории — превью', node: <CategoriesPreview items={data.homepage_categories} /> })}
              >
                Превью
              </button>
            }
          >
            <ArrayEditor<ContentCategory>
              items={data.homepage_categories}
              onChange={(v) => updateSection('homepage_categories', v)}
              blank={() => ({ catalogKey: CATEGORY_KEYS[0] ?? '', title: '', image: '' })}
              itemLabel={(i, item) => `Категория ${i + 1}${item.title ? ` — ${item.title}` : ''}`}
              addLabel="+ Добавить категорию"
              max={12}
              renderItem={(item, _, update) => (
                <>
                  <div className="admin__field-grid-2">
                    <SelectField
                      label="Тип"
                      value={item.catalogKey}
                      options={CATEGORY_KEYS.map((k) => ({ value: k, label: CATEGORY_KEY_LABELS[k] ?? k }))}
                      onChange={(v) => update({ catalogKey: v })}
                    />
                    <Field label="Заголовок" value={item.title} onChange={(v) => update({ title: v })} />
                  </div>
                  <ImageField label="Фото (URL)" value={item.image} onChange={(v) => update({ image: v })} />
                </>
              )}
            />
          </AccordionSection>

          <AccordionSection
            title="Преимущества"
            description="3 карточки «почему мы» — отображаются на главной под hero."
            count={data.homepage_perks.length}
            dirty={dirty.has('homepage_perks')}
            actions={
              <button
                type="button"
                className="accordion__btn"
                onClick={() => setPreview({ title: 'Преимущества — превью', node: <PerksPreview items={data.homepage_perks} /> })}
              >
                Превью
              </button>
            }
          >
            <ArrayEditor<ContentPerk>
              items={data.homepage_perks}
              onChange={(v) => updateSection('homepage_perks', v)}
              blank={() => ({ title: '', desc: '' })}
              itemLabel={(i, item) => `Преимущество ${i + 1}${item.title ? ` — ${item.title}` : ''}`}
              addLabel="+ Добавить преимущество"
              max={6}
              renderItem={(item, _, update) => (
                <>
                  <Field label="Заголовок" value={item.title} onChange={(v) => update({ title: v })} />
                  <MultilineField label="Описание" rows={2} value={item.desc} onChange={(v) => update({ desc: v })} />
                </>
              )}
            />
          </AccordionSection>

          <AccordionSection
            title="Блок новостей / блог"
            description="Карточки в горизонтальном слайдере «Наш блог». Каждая карточка ведёт на страницу /news/<id>."
            count={data.homepage_news.length}
            dirty={dirty.has('homepage_news')}
            actions={
              <button
                type="button"
                className="accordion__btn"
                onClick={() => setPreview({ title: 'Блок новостей — превью', node: <NewsBlock items={data.homepage_news} /> })}
              >
                Превью
              </button>
            }
          >
            <ArrayEditor<NewsItemAdmin>
              items={data.homepage_news}
              onChange={(v) => updateSection('homepage_news', v)}
              blank={() => ({ ...BLANK_NEWS, id: `news-${Date.now()}` })}
              itemLabel={(i, item) => `Новость ${i + 1}${item.title ? ` — ${item.title.slice(0, 32)}` : ''}`}
              addLabel="+ Добавить новость"
              max={24}
              renderItem={(item, _, update) => (
                <>
                  <div className="admin__field-grid-2">
                    <Field label="ID (уникальный, для URL)" value={item.id} onChange={(v) => update({ id: v })} placeholder="news-1" />
                    <Field label="Тег" value={item.tag ?? ''} onChange={(v) => update({ tag: v })} placeholder="обзоры" />
                  </div>
                  <Field label="Заголовок" value={item.title} onChange={(v) => update({ title: v })} />
                  <MultilineField label="Краткий анонс" rows={2} value={item.excerpt ?? ''} onChange={(v) => update({ excerpt: v })} />
                  <MultilineField
                    label="Полный текст статьи"
                    hint="Открывается на /news/<id>. Абзацы разделяйте пустой строкой."
                    rows={6}
                    value={item.body ?? ''}
                    onChange={(v) => update({ body: v })}
                  />
                  <div className="admin__field-grid-2">
                    <Field label="Дата" value={item.date ?? ''} onChange={(v) => update({ date: v })} placeholder="05 мая 2026" />
                    <Field label="Время чтения" value={item.readMin ?? ''} onChange={(v) => update({ readMin: v })} placeholder="5 мин чтения" />
                  </div>
                  <ImageField label="Фото (URL)" value={item.image ?? ''} onChange={(v) => update({ image: v })} />
                  <Field label="Ссылка на первоисточник (опц.)" value={item.url ?? ''} onChange={(v) => update({ url: v })} placeholder="https://..." />
                </>
              )}
            />
          </AccordionSection>

          <AccordionSection
            title="Блогеры (превью)"
            description="Состав блока «выбор блогеров» — карточки с фото, бренды-партнёры и сетапы. Редактируется в отдельной вкладке «Блогеры» сверху, здесь только превью."
            actions={
              <button
                type="button"
                className="accordion__btn"
                onClick={() => setPreview({ title: 'Блогеры — превью', node: <BloggersLivePreview /> })}
              >
                Превью
              </button>
            }
          >
            <p className="admin__label-hint" style={{ margin: 0 }}>
              Чтобы добавить или поменять блогеров — откройте вкладку «Блогеры» в верхней панели админки. Этот аккордеон только показывает текущее состояние и даёт быстрый предпросмотр.
            </p>
          </AccordionSection>

          <AccordionSection
            title="Шапка и подвал сайта"
            description="Контакты (адрес, часы работы, email) и подписи кнопок верхней панели. Применяются к шапке и футеру всех страниц."
            dirty={dirty.has('site_chrome')}
          >
            <Field
              label="Заголовок секции «всегда на связи»"
              value={data.site_chrome.alwaysAvailable ?? ''}
              onChange={(v) => updateSection('site_chrome', { ...data.site_chrome, alwaysAvailable: v })}
            />
            <div className="admin__field-grid-2">
              <Field
                label="Адрес"
                value={data.site_chrome.address ?? ''}
                onChange={(v) => updateSection('site_chrome', { ...data.site_chrome, address: v })}
                placeholder="вологда, somewhere 228"
              />
              <Field
                label="Часы работы"
                value={data.site_chrome.workHours ?? ''}
                onChange={(v) => updateSection('site_chrome', { ...data.site_chrome, workHours: v })}
                placeholder="пн - пт: 09:00 - 20:00"
              />
            </div>
            <Field
              label="Email для связи"
              value={data.site_chrome.email ?? ''}
              onChange={(v) => updateSection('site_chrome', { ...data.site_chrome, email: v })}
              placeholder="hello@kolman.shop"
            />
            <div className="admin__field">
              <span className="admin__label">
                Подписи верхней навигации
                <span className="admin__label-hint"> · 5 ссылок: о нас / партнёрство / поддержка / помочь с выбором / доставка</span>
              </span>
              <div className="admin__field-grid-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <input
                    key={i}
                    className="admin__input"
                    value={(data.site_chrome.topLinks ?? [])[i] ?? ''}
                    onChange={(e) => {
                      const arr = [...(data.site_chrome.topLinks ?? [])]
                      arr[i] = e.target.value
                      updateSection('site_chrome', { ...data.site_chrome, topLinks: arr })
                    }}
                  />
                ))}
              </div>
            </div>
          </AccordionSection>

          <AccordionSection
            title="Бренды (логотипы в карусели)"
            description="Логотипы в бегущей строке внизу главной. Slug = идентификатор страницы бренда (/brand/<slug>). Если пустой — клик ведёт на каталог по этому бренду."
            count={data.brand_logos.length}
            dirty={dirty.has('brand_logos')}
          >
            <ArrayEditor<BrandLogo>
              items={data.brand_logos}
              onChange={(v) => updateSection('brand_logos', v)}
              blank={() => ({ name: '', slug: '', image: '', url: '' })}
              itemLabel={(i, item) => `Бренд ${i + 1}${item.name ? ` — ${item.name}` : ''}`}
              addLabel="+ Добавить бренд"
              max={30}
              renderItem={(item, _, update) => (
                <>
                  <div className="admin__field-grid-2">
                    <Field label="Название" value={item.name} onChange={(v) => update({ name: v })} placeholder="WLMOUSE" />
                    <Field label="Slug (для /brand/<slug>)" value={item.slug ?? ''} onChange={(v) => update({ slug: v })} placeholder="wlmouse" />
                  </div>
                  <ImageField label="Лого (URL)" value={item.image} onChange={(v) => update({ image: v })} />
                  <Field
                    label="Ссылка по клику (опц.)"
                    hint="оставьте пустым чтобы вёл на /brand/<slug>"
                    value={item.url ?? ''}
                    onChange={(v) => update({ url: v })}
                  />
                </>
              )}
            />
          </AccordionSection>

          <AccordionSection
            title="Рекламный блок бренда на главной"
            description="Управляет блоком брендовой промо-зоны на главной странице. Здесь можно поменять бренд, ссылку и фон."
            dirty={dirty.has('homepage_brand_spotlight')}
          >
            <Field
              label="Slug бренда"
              value={data.homepage_brand_spotlight.brandSlug}
              onChange={(v) => updateSection('homepage_brand_spotlight', { ...data.homepage_brand_spotlight, brandSlug: v })}
              placeholder="wlmouse"
            />
            <Field
              label="Название бренда"
              value={data.homepage_brand_spotlight.brandLabel}
              onChange={(v) => updateSection('homepage_brand_spotlight', { ...data.homepage_brand_spotlight, brandLabel: v })}
              placeholder="WLMOUSE"
            />
            <ImageField
              label="Фон баннера (URL)"
              value={data.homepage_brand_spotlight.bannerImage}
              onChange={(v) => updateSection('homepage_brand_spotlight', { ...data.homepage_brand_spotlight, bannerImage: v })}
            />
            <Field
              label="Ссылка по клику"
              hint="/brand/<slug>, /catalog?brand=..., https://..."
              value={data.homepage_brand_spotlight.bannerUrl ?? ''}
              onChange={(v) => updateSection('homepage_brand_spotlight', { ...data.homepage_brand_spotlight, bannerUrl: v })}
              placeholder="/brand/wlmouse"
            />
            <Field
              label="Текст кнопки"
              value={data.homepage_brand_spotlight.buttonText ?? ''}
              onChange={(v) => updateSection('homepage_brand_spotlight', { ...data.homepage_brand_spotlight, buttonText: v })}
              placeholder="перейти к бренду →"
            />
          </AccordionSection>

          <AccordionSection
            title="Поиск — популярные разделы"
            description="Чипы в выпадашке поиска. Не зависят от языка контента."
            count={data.search_popular_sections.length}
            dirty={dirty.has('search_popular_sections')}
          >
            <ArrayEditor<SearchSectionAdmin>
              items={data.search_popular_sections}
              onChange={(v) => updateSection('search_popular_sections', v)}
              blank={() => ({ label: '', catalogKey: CATEGORY_KEYS[0] ?? '' })}
              itemLabel={(i, item) => `Раздел ${i + 1}${item.label ? ` — ${item.label}` : ''}`}
              addLabel="+ Добавить раздел"
              max={12}
              renderItem={(item, _, update) => (
                <div className="admin__field-grid-2">
                  <Field label="Подпись" value={item.label} onChange={(v) => update({ label: v })} />
                  <SelectField
                    label="Тип"
                    value={item.catalogKey}
                    options={[{ value: '', label: '— любой —' }, ...CATEGORY_KEYS.map((k) => ({ value: k, label: CATEGORY_KEY_LABELS[k] ?? k }))]}
                    onChange={(v) => update({ catalogKey: v })}
                  />
                </div>
              )}
            />
          </AccordionSection>
        </div>
      )}

      <PreviewModal open={preview !== null} title={preview?.title ?? ''} onClose={() => setPreview(null)}>
        {preview?.node}
      </PreviewModal>
    </div>
  )
}

// ── Inline field components ──
function Field({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div className="admin__field">
      <span className="admin__label">{label}{hint && <span className="admin__label-hint"> · {hint}</span>}</span>
      <input className="admin__input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function MultilineField({ label, value, onChange, rows = 3, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <div className="admin__field">
      <span className="admin__label">{label}{hint && <span className="admin__label-hint"> · {hint}</span>}</span>
      <textarea
        className="admin__input"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ resize: 'vertical', fontFamily: 'inherit', minHeight: rows * 22 }}
      />
    </div>
  )
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="admin__field">
      <span className="admin__label">{label}</span>
      <div className="admin__image-field">
        <input className="admin__input" type="url" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://..." />
        {value ? (
          <img className="admin__image-preview" src={value} alt="preview" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }} />
        ) : (
          <div className="admin__image-preview admin__image-preview--empty" />
        )}
      </div>
    </div>
  )
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="admin__field">
      <span className="admin__label">{label}</span>
      <select className="admin__input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ── Real hero preview ──
//
// Mirrors what HomePage actually renders: the hero-card with the current
// slide on the left, and the full side-panel (promo "ready to gear up" +
// catalog status) on the right. Uses the live i18n strings so the side panel
// matches what shoppers see in their language.
function HeroPreview({ slides }: { slides: HeroSlide[] }) {
  const { t } = useTranslation()
  const [current, setCurrent] = useState(0)
  if (slides.length === 0) {
    return <p style={{ padding: 40, color: 'var(--color-text-dim)' }}>Слайды не добавлены.</p>
  }
  const idx = current % slides.length
  const slide = slides[idx]
  return (
    <div style={previewFrame}>
      <div className="hero-grid">
      <div className="hero-card" style={{ minHeight: 420 }}>
        {slide.image && (
          <div className="hero-card__image" style={{ backgroundImage: `url("${slide.image}")` }} />
        )}
        <div className="hero-card__overlay" />
        <div className="hero-card__accent" />
        <div className="hero-card__content">
          <div key={idx} className="hero-card__copy">
            {slide.tag && <span className="hero-tag">{slide.tag}</span>}
            <h1 className="hero-title">{slide.title}</h1>
            <p className="hero-subtitle">{slide.subtitle}</p>
            <p className="hero-accent-text">{slide.accent}</p>
          </div>
          {slides.length > 1 && (
            <div className="hero-dots" aria-label="slides navigation">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`dot ${i === idx ? 'active' : ''}`}
                  onClick={() => setCurrent(i)}
                  aria-label={`open slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
        {slides.length > 1 && (
          <div className="hero-arrows">
            <button
              type="button"
              className="slide-btn"
              onClick={() => setCurrent((p) => (p - 1 + slides.length) % slides.length)}
              aria-label="previous slide"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="slide-btn slide-btn--accent"
              onClick={() => setCurrent((p) => (p + 1) % slides.length)}
              aria-label="next slide"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {/* Real side panel — same markup as the live homepage's <aside>. */}
      <aside className="side-panel">
        <div className="promo-card promo-card--accent" role="presentation">
          <svg className="promo-card__shape" width="180" height="180" viewBox="0 0 180 180" aria-hidden="true">
            <rect x="60" y="-30" width="120" height="120" rx="30" fill="#fff" transform="rotate(20 90 90)" />
            <rect x="90" y="40" width="100" height="100" rx="24" fill="#fff" transform="rotate(10 90 90)" />
          </svg>
          <p className="promo-label">{t('ui.readyToGearUp')}</p>
          <h2 className="promo-title">{t('ui.startShopping')}</h2>
          <span className="promo-arrow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </span>
        </div>
        <div className="promo-card promo-card--catalog" role="presentation">
          <div className="catalog-status">
            <span className="catalog-status__dot" />
            <span>{t('ui.fullCatalog')}</span>
          </div>
          <p className="catalog-text">{t('ui.catalogText')}</p>
        </div>
      </aside>
      </div>
    </div>
  )
}

// 1280px max-width frame matching the real `.container`. Used by every
// preview that's NOT full-bleed (news section is full-bleed by design).
const previewFrame: React.CSSProperties = {
  width: 'min(1280px, 100%)',
  margin: '0 auto',
  padding: '24px 16px',
}

function CategoriesPreview({ items }: { items: ContentCategory[] }) {
  const { t } = useTranslation()
  if (items.length === 0) {
    return <p style={{ padding: 40, color: 'var(--color-text-dim)' }}>Категории не добавлены.</p>
  }
  // Wrap in the same `.showcase-section` + `.section-heading` that the homepage
  // uses so the admin sees the kicker, title and note rendered together with
  // the category grid — not just a bare row of cards.
  return (
    <div style={previewFrame}>
      <section className="showcase-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">{t('ui.catalogHighlights')}</p>
            <h2 className="section-title">{t('ui.categoriesTitle')}</h2>
          </div>
          <p className="section-note">{t('ui.categoriesNote')}</p>
        </div>
        <div className="category-grid">
          {items.map((c, i) => (
            <div key={i} className="category-card" style={{ cursor: 'default' }}>
              <div className="category-card__top">
                <h3 className="category-card__title">{c.title}</h3>
                <span className="category-card__arrow" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              </div>
              <div
                className="category-card__image"
                style={c.image ? { backgroundImage: `url("${c.image}")` } : undefined}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// Default icons matching the original homepage order (shield / truck / star).
// We re-use them in the preview so cards have visible icons instead of empty boxes.
const PERK_ICONS = [
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" key="shield">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" key="delivery">
      <rect x="1" y="3" width="15" height="13" rx="2" />
      <path d="M16 8h4l3 5v3h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  ),
  (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" key="star">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
]

function PerksPreview({ items }: { items: ContentPerk[] }) {
  if (items.length === 0) {
    return <p style={{ padding: 40, color: 'var(--color-text-dim)' }}>Преимущества не добавлены.</p>
  }
  return (
    <div style={previewFrame}>
      <div className="perks-grid">
        {items.map((perk, i) => (
          <article key={i} className="perk-card">
            <div className="perk-card__icon">{PERK_ICONS[i % PERK_ICONS.length]}</div>
            <div>
              <h3 className="perk-card__title">{perk.title}</h3>
              <p className="perk-card__text">{perk.desc}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

// Live preview of the homepage Bloggers block — uses the real component
// and the real products list, so admin sees exactly what shoppers will see.
function BloggersLivePreview() {
  const { products } = useProducts()
  return (
    <div style={previewFrame}>
      <BloggersBlock products={products} />
    </div>
  )
}
