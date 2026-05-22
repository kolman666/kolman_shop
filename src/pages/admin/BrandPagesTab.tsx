import { useEffect, useState } from 'react'
import { fetchSiteContent, updateSiteContent } from '../../lib/siteContent'
import { AccordionSection } from './AccordionSection'
import { ArrayEditor } from './ArrayEditor'
import { PreviewModal } from './PreviewModal'
import BrandPage from '../BrandPage'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Per-brand detail page editor (writes to `brand_data_<slug>_<lang>` in
// site_content). The slug list is pulled from the `brand_logos` content
// block, so admin only has to manage the logo carousel and the brand
// pages auto-track that.

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

export function BrandPagesTab() {
  const [logos, setLogos] = useState<BrandLogo[]>([])
  const [lang, setLang] = useState<'ru' | 'en'>('ru')
  const [activeSlug, setActiveSlug] = useState<string>('')
  const [data, setData] = useState<BrandPageData>({})
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  // Load slug list from brand_logos. Falls back to a manual slug input if
  // admin hasn't filled the carousel yet.
  useEffect(() => {
    let cancelled = false
    void fetchSiteContent<BrandLogo[]>('brand_logos').then((r) => {
      if (cancelled) return
      const items = (r.data ?? []).filter((b) => (b.slug ?? '').trim().length > 0)
      setLogos(items)
      if (items.length > 0 && !activeSlug) setActiveSlug(items[0].slug as string)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load page content whenever slug or language changes.
  useEffect(() => {
    if (!activeSlug) { setData({}); setDirty(false); return }
    setLoading(true)
    setError('')
    void fetchSiteContent<BrandPageData>(`brand_data_${activeSlug}_${lang}`).then((r) => {
      setData(r.data ?? {})
      setDirty(false)
      setLoading(false)
    })
  }, [activeSlug, lang])

  function patch(p: Partial<BrandPageData>) {
    setData((prev) => ({ ...prev, ...p }))
    setDirty(true)
  }

  async function save() {
    if (!activeSlug || !dirty) return
    setSaving(true)
    setError('')
    try {
      await updateSiteContent(`brand_data_${activeSlug}_${lang}`, data)
      setDirty(false)
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
          <h2 className="admin__topbar-title">Бренд-страницы</h2>
          {logos.length === 0 ? (
            <p className="admin__label-hint" style={{ margin: 0 }}>
              Сначала добавьте бренды в «Главная → Бренды» (с заполненным slug).
            </p>
          ) : (
            <div className="admin__page-picker">
              {logos.map((b) => (
                <button
                  key={b.slug}
                  type="button"
                  className={`admin__page-pick ${activeSlug === b.slug ? 'admin__page-pick--active' : ''}`.trim()}
                  onClick={() => setActiveSlug(b.slug as string)}
                  disabled={dirty}
                  title={dirty ? 'Сначала сохраните изменения' : ''}
                >
                  {b.name || b.slug}
                </button>
              ))}
            </div>
          )}
          <div className="admin__lang-row">
            <span className="admin__label" style={{ margin: 0 }}>Язык:</span>
            <div className="admin__lang-tabs">
              {(['ru', 'en'] as const).map((lng) => (
                <button
                  key={lng}
                  type="button"
                  className={`admin__lang-tab ${lang === lng ? 'admin__lang-tab--active' : ''}`.trim()}
                  onClick={() => setLang(lng)}
                  disabled={dirty}
                >
                  {lng.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="admin__topbar-right">
          <span className="admin__topbar-meta">
            {dirty ? <>несохранённые изменения</> : savedAt ? <>сохранено · {new Date(savedAt).toLocaleTimeString('ru-RU')}</> : <>чисто</>}
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
        <div className="admin__content-empty"><p className="admin__empty-text">Выберите бренд сверху или добавьте его в карусели брендов.</p></div>
      ) : loading ? (
        <div className="admin__content-empty"><p className="admin__empty-text">Загрузка...</p></div>
      ) : (
        <>
          <AccordionSection title="Hero (шапка страницы)" defaultOpen>
            <Field label="Название бренда" value={data.name ?? ''} onChange={(v) => patch({ name: v })} placeholder="WLMOUSE" />
            <Field label="Tagline (одна короткая фраза)" value={data.tagline ?? ''} onChange={(v) => patch({ tagline: v })} placeholder="лёгкие мыши для киберспорта" />
            <ImageField label="Баннер (фон hero)" value={data.banner ?? ''} onChange={(v) => patch({ banner: v })} />
            <ImageField label="Логотип" value={data.logo ?? ''} onChange={(v) => patch({ logo: v })} />
            <Field label="Сайт бренда (опц.)" value={data.website ?? ''} onChange={(v) => patch({ website: v })} placeholder="https://..." />
          </AccordionSection>

          <AccordionSection title="Описание">
            <MultiField
              label="Текст"
              rows={6}
              value={data.description ?? ''}
              onChange={(v) => patch({ description: v })}
              hint="абзацы разделяйте пустой строкой"
            />
          </AccordionSection>

          <AccordionSection title="Преимущества (плитки)" count={(data.highlights ?? []).length}>
            <ArrayEditor<Highlight>
              items={data.highlights ?? []}
              onChange={(v) => patch({ highlights: v })}
              blank={() => ({ title: '', text: '' })}
              itemLabel={(i, item) => `Плитка ${i + 1}${item.title ? ` — ${item.title}` : ''}`}
              addLabel="+ Добавить плитку"
              max={9}
              renderItem={(item, _, update) => (
                <>
                  <Field label="Заголовок" value={item.title} onChange={(v) => update({ title: v })} />
                  <MultiField label="Текст" rows={2} value={item.text} onChange={(v) => update({ text: v })} />
                </>
              )}
            />
          </AccordionSection>

          <AccordionSection title="Каталог бренда">
            <Field
              label="Фильтр по бренду"
              hint="строка для поиска в product.brand. Пустое = используется slug"
              value={data.brandFilter ?? ''}
              onChange={(v) => patch({ brandFilter: v })}
              placeholder={activeSlug}
            />
          </AccordionSection>
        </>
      )}

      <PreviewModal
        open={previewOpen}
        title={`${data.name || activeSlug} — превью`}
        onClose={() => setPreviewOpen(false)}
      >
        {/*
          Render the real BrandPage inside a MemoryRouter so its useParams()
          picks up the slug we're editing. The component itself fetches data
          from site_content — to preview unsaved edits we'd need a context
          override; for now the preview reflects the last *saved* version,
          which is honest and matches what shoppers will see right after the
          admin clicks Save.
        */}
        <MemoryRouter initialEntries={[`/brand/${activeSlug}`]}>
          <Routes>
            <Route path="/brand/:slug" element={<BrandPage />} />
          </Routes>
        </MemoryRouter>
      </PreviewModal>
    </div>
  )
}

// ── Tiny field helpers (mirrors the ones inside ContentTabV2) ──
function Field({ label, value, onChange, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string }) {
  return (
    <div className="admin__field">
      <span className="admin__label">{label}{hint && <span className="admin__label-hint"> · {hint}</span>}</span>
      <input className="admin__input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
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
        onChange={(e) => onChange(e.target.value)}
        style={{ resize: 'vertical', fontFamily: 'inherit' }}
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
