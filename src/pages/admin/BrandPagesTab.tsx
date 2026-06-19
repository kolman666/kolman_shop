import { useEffect, useMemo, useState } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { fetchSiteContent, updateSiteContent } from '../../lib/siteContent'
import { AccordionSection } from './AccordionSection'
import { ArrayEditor } from './ArrayEditor'
import MediaPicker from '../../components/admin/MediaPicker'
import { PreviewModal } from './PreviewModal'
import BrandPage, { BrandPagePreviewProvider } from '../BrandPage'

type BrandLogo = {
  name: string
  slug?: string
  image: string
  url?: string
}

type Highlight = { title: string; text: string }

type BrandPageData = {
  name?: string
  tagline?: string
  description?: string
  banner?: string
  logo?: string
  website?: string
  brandFilter?: string
  highlights?: Highlight[]
}

const BLANK_BRAND: BrandPageData = {
  name: '',
  tagline: '',
  description: '',
  banner: '',
  logo: '',
  website: '',
  brandFilter: '',
  highlights: [],
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function BrandPagesTab() {
  const [logos, setLogos] = useState<BrandLogo[]>([])
  const [lang, setLang] = useState<'ru' | 'en'>('ru')
  const [activeSlug, setActiveSlug] = useState('')
  const [data, setData] = useState<BrandPageData>(BLANK_BRAND)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [newBrandName, setNewBrandName] = useState('')
  const [newBrandSlug, setNewBrandSlug] = useState('')
  const [addingBrand, setAddingBrand] = useState(false)

  const brandOptions = useMemo(
    () => logos.filter((brand) => (brand.slug ?? '').trim().length > 0),
    [logos],
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchSiteContent<BrandLogo[]>('brand_logos').then((result) => {
      if (cancelled) return
      const items = (result.data ?? []).map((brand) => ({
        ...brand,
        slug: slugify(brand.slug || brand.name),
      }))
      setLogos(items)
      if (items.length > 0) setActiveSlug((current) => current || (items[0].slug ?? ''))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!activeSlug) {
      setData(BLANK_BRAND)
      setDirty(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')
    void fetchSiteContent<BrandPageData>(`brand_data_${activeSlug}_${lang}`).then((result) => {
      if (cancelled) return
      const logo = logos.find((brand) => brand.slug === activeSlug)
      // Strip empty strings/arrays from the server result before merging.
      // A previously-saved `name: ""` would overwrite the brand_logos fallback
      // name and the preview hero would render with no visible title — looked
      // like a black screen to the admin.
      const cleanedResult: Partial<BrandPageData> = {}
      if (result.data) {
        for (const [k, v] of Object.entries(result.data)) {
          if (v == null) continue
          if (typeof v === 'string' && v.trim() === '') continue
          if (Array.isArray(v) && v.length === 0) continue
          ;(cleanedResult as Record<string, unknown>)[k] = v
        }
      }
      setData({
        ...BLANK_BRAND,
        name: logo?.name ?? '',
        logo: logo?.image ?? '',
        ...cleanedResult,
      })
      setDirty(false)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [activeSlug, lang, logos])

  function patch(partial: Partial<BrandPageData>) {
    setData((prev) => ({ ...prev, ...partial }))
    setDirty(true)
  }

  async function addBrand() {
    const name = newBrandName.trim()
    const slug = slugify(newBrandSlug || name)
    if (!name || !slug) {
      setError('Заполните название и slug бренда.')
      return
    }
    if (brandOptions.some((brand) => brand.slug === slug)) {
      setError('Бренд с таким slug уже есть.')
      return
    }

    setAddingBrand(true)
    setError('')
    try {
      const nextLogos = [...logos, { name, slug, image: '', url: '' }]
      await updateSiteContent('brand_logos', nextLogos)
      await updateSiteContent(`brand_data_${slug}_${lang}`, { ...BLANK_BRAND, name, brandFilter: name })
      setLogos(nextLogos)
      setActiveSlug(slug)
      setData({ ...BLANK_BRAND, name, brandFilter: name })
      setNewBrandName('')
      setNewBrandSlug('')
      setDirty(false)
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить бренд')
    } finally {
      setAddingBrand(false)
    }
  }

  async function save() {
    if (!activeSlug || !dirty) return
    setSaving(true)
    setError('')
    try {
      await updateSiteContent(`brand_data_${activeSlug}_${lang}`, data)
      setDirty(false)
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="admin__content-tab">
      <div className="admin__topbar">
        <div className="admin__topbar-left">
          <h2 className="admin__topbar-title">Бренд-страницы</h2>
          <p className="admin__label-hint" style={{ margin: 0 }}>
            Отдельные страницы брендов открываются по адресу /brand/slug. Новый бренд также появится в блоке логотипов на главной.
          </p>

          <div className="admin__page-picker">
            {brandOptions.map((brand) => (
              <button
                key={brand.slug}
                type="button"
                className={`admin__page-pick ${activeSlug === brand.slug ? 'admin__page-pick--active' : ''}`.trim()}
                onClick={() => {
                  if (activeSlug === brand.slug) return
                  if (dirty && !confirm('Есть несохранённые изменения. Переключить бренд и потерять их?')) return
                  setActiveSlug(brand.slug ?? '')
                }}
                title={dirty ? 'Есть несохранённые изменения' : ''}
              >
                {brand.name || brand.slug}
              </button>
            ))}
          </div>

          <div className="admin__field-grid-2" style={{ width: '100%' }}>
            <Field
              label="Новый бренд"
              value={newBrandName}
              onChange={(value) => {
                setNewBrandName(value)
                if (!newBrandSlug.trim()) setNewBrandSlug(slugify(value))
              }}
              placeholder="WLMOUSE"
            />
            <Field
              label="Slug"
              hint="латиница, цифры и дефис"
              value={newBrandSlug}
              onChange={(value) => setNewBrandSlug(slugify(value))}
              placeholder="wlmouse"
            />
          </div>
          <button type="button" className="accordion__btn" onClick={() => void addBrand()} disabled={addingBrand || !newBrandName.trim()}>
            {addingBrand ? 'Добавляем...' : '+ Добавить бренд'}
          </button>

          <div className="admin__lang-row">
            <span className="admin__label" style={{ margin: 0 }}>Язык:</span>
            <div className="admin__lang-tabs">
              {(['ru', 'en'] as const).map((lng) => (
                <button
                  key={lng}
                  type="button"
                  className={`admin__lang-tab ${lang === lng ? 'admin__lang-tab--active' : ''}`.trim()}
                  onClick={() => {
                    if (lang === lng) return
                    if (dirty && !confirm('Есть несохранённые изменения. Переключить язык и потерять их?')) return
                    setLang(lng)
                  }}
                  title={dirty ? 'Есть несохранённые изменения' : ''}
                >
                  {lng.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="admin__topbar-right">
          <span className="admin__topbar-meta">
            {dirty ? <>несохранённые изменения</> : savedAt ? <>сохранено · {new Date(savedAt).toLocaleTimeString('ru-RU')}</> : <>все данные сохранены</>}
          </span>
          {error && <span style={{ color: 'var(--color-main)', fontSize: 13 }}>{error}</span>}
          <button
            type="button"
            className="accordion__btn"
            onClick={() => setPreviewOpen(true)}
            disabled={loading || !activeSlug}
          >
            Превью
          </button>
          <button
            type="button"
            className={`admin__save-all ${dirty ? 'admin__save-all--dirty' : ''}`.trim()}
            onClick={() => void save()}
            disabled={saving || !dirty}
          >
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {!activeSlug ? (
        <div className="admin__content-empty"><p className="admin__empty-text">Добавьте первый бренд сверху, чтобы создать страницу.</p></div>
      ) : loading ? (
        <div className="admin__content-empty"><p className="admin__empty-text">Загрузка...</p></div>
      ) : (
        <div className="admin__accordions">
          <AccordionSection title="Hero страницы" defaultOpen>
            <Field label="Название бренда" value={data.name ?? ''} onChange={(value) => patch({ name: value })} placeholder="WLMOUSE" />
            <Field label="Короткая фраза" value={data.tagline ?? ''} onChange={(value) => patch({ tagline: value })} placeholder="лёгкие мыши для киберспорта" />
            <ImageField label="Баннер" value={data.banner ?? ''} onChange={(value) => patch({ banner: value })} />
            <ImageField label="Логотип" value={data.logo ?? ''} onChange={(value) => patch({ logo: value })} />
            <Field label="Сайт бренда" value={data.website ?? ''} onChange={(value) => patch({ website: value })} placeholder="https://..." />
          </AccordionSection>

          <AccordionSection title="Описание">
            <MultiField
              label="Текст"
              rows={6}
              value={data.description ?? ''}
              onChange={(value) => patch({ description: value })}
              hint="абзацы разделяйте пустой строкой"
            />
          </AccordionSection>

          <AccordionSection title="Преимущества" count={(data.highlights ?? []).length}>
            <ArrayEditor<Highlight>
              items={data.highlights ?? []}
              onChange={(value) => patch({ highlights: value })}
              blank={() => ({ title: '', text: '' })}
              itemLabel={(index, item) => `Плитка ${index + 1}${item.title ? ` - ${item.title}` : ''}`}
              addLabel="+ Добавить плитку"
              max={9}
              renderItem={(item, _, update) => (
                <>
                  <Field label="Заголовок" value={item.title} onChange={(value) => update({ title: value })} />
                  <MultiField label="Текст" rows={2} value={item.text} onChange={(value) => update({ text: value })} />
                </>
              )}
            />
          </AccordionSection>

          <AccordionSection title="Каталог бренда">
            <Field
              label="Фильтр по бренду"
              hint="строка для поиска в product.brand. Пустое = используется slug"
              value={data.brandFilter ?? ''}
              onChange={(value) => patch({ brandFilter: value })}
              placeholder={activeSlug}
            />
          </AccordionSection>
        </div>
      )}

      <PreviewModal
        open={previewOpen}
        title={`${data.name || activeSlug} - превью`}
        onClose={() => setPreviewOpen(false)}
      >
        <BrandPagePreviewProvider data={data}>
          <MemoryRouter initialEntries={[`/brand/${activeSlug}`]}>
            <Routes>
              <Route path="/brand/:slug" element={<BrandPage />} />
            </Routes>
          </MemoryRouter>
        </BrandPagePreviewProvider>
      </PreviewModal>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div className="admin__field">
      <span className="admin__label">{label}{hint && <span className="admin__label-hint"> · {hint}</span>}</span>
      <input className="admin__input" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  )
}

function MultiField({ label, value, onChange, rows = 3, hint }: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) {
  return (
    <div className="admin__field">
      <span className="admin__label">{label}{hint && <span className="admin__label-hint"> · {hint}</span>}</span>
      <textarea
        className="admin__input"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ resize: 'vertical', fontFamily: 'inherit' }}
      />
    </div>
  )
}

function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="admin__field">
      <MediaPicker label={label} value={value} onChange={onChange} />
    </div>
  )
}
