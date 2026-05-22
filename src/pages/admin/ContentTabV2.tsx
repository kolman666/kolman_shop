import { useEffect, useState, type ReactNode } from 'react'
import { fetchSiteContent, updateSiteContent } from '../../lib/siteContent'
import NewsBlock, { type NewsItem } from '../../components/NewsBlock'
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

type SectionKey = 'hero_slides' | 'homepage_categories' | 'homepage_perks' | 'homepage_news' | 'search_popular_sections'

type State = {
  hero_slides: HeroSlide[]
  homepage_categories: ContentCategory[]
  homepage_perks: ContentPerk[]
  homepage_news: NewsItemAdmin[]
  search_popular_sections: SearchSectionAdmin[]
}

const INITIAL: State = {
  hero_slides: [],
  homepage_categories: [],
  homepage_perks: [],
  homepage_news: [],
  search_popular_sections: [],
}

// Keys that are language-suffixed in storage (`{key}_{lang}`).
const LOCALIZED: SectionKey[] = ['hero_slides', 'homepage_categories', 'homepage_perks', 'homepage_news']

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
    const sections: SectionKey[] = ['hero_slides', 'homepage_categories', 'homepage_perks', 'homepage_news', 'search_popular_sections']
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
        if (Array.isArray(value)) (next as Record<SectionKey, unknown>)[s] = value
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

// ── Real hero preview (uses actual .hero-card CSS so admin sees what the
//    homepage will render). Renders the current slide with prev/next arrows
//    so the admin can step through all of them. ──
function HeroPreview({ slides }: { slides: HeroSlide[] }) {
  const [current, setCurrent] = useState(0)
  if (slides.length === 0) {
    return <p style={{ padding: 40, color: 'var(--color-text-dim)' }}>Слайды не добавлены.</p>
  }
  const idx = current % slides.length
  const slide = slides[idx]
  return (
    <div style={{ padding: 24 }}>
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
    </div>
  )
}

function CategoriesPreview({ items }: { items: ContentCategory[] }) {
  if (items.length === 0) return <p style={{ padding: 40, color: 'var(--color-text-dim)' }}>Категории не добавлены.</p>
  return (
    <div style={{ padding: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
      {items.map((c, i) => (
        <div key={i} style={{
          minHeight: 180,
          padding: 18,
          borderRadius: 16,
          border: '1px solid var(--color-border)',
          backgroundImage: c.image ? `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url("${c.image}")` : undefined,
          backgroundColor: c.image ? undefined : 'var(--color-bg-elevated)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: 'var(--color-text)',
          display: 'flex',
          alignItems: 'flex-end',
        }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>{c.title}</h3>
        </div>
      ))}
    </div>
  )
}

function PerksPreview({ items }: { items: ContentPerk[] }) {
  if (items.length === 0) return <p style={{ padding: 40, color: 'var(--color-text-dim)' }}>Преимущества не добавлены.</p>
  return (
    <div style={{ padding: 32, display: 'grid', gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, minmax(0, 1fr))`, gap: 12 }}>
      {items.map((p, i) => (
        <div key={i} className="perk-card" style={{ flexDirection: 'column', gap: 12 }}>
          <div className="perk-card__icon" />
          <div>
            <h3 className="perk-card__title">{p.title}</h3>
            <p className="perk-card__text">{p.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
