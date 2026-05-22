import { useEffect, useState, type ComponentType } from 'react'
import { fetchSiteContent, updateSiteContent } from '../../lib/siteContent'
import { AccordionSection } from './AccordionSection'
import { ArrayEditor } from './ArrayEditor'
import { PreviewModal } from './PreviewModal'
import { PageContentOverrideProvider, type PageId as HookPageId } from '../../hooks/usePageContent'
import AboutPage from '../AboutPage'
import PartnershipPage from '../PartnershipPage'
import DeliveryPage from '../DeliveryPage'
import ModdingPage from '../ModdingPage'
import HelpChoosePage from '../HelpChoosePage'
import SupportPage from '../SupportPage'
import UsedMarketPage from '../UsedMarketPage'

type PageId = 'about' | 'partnership' | 'delivery' | 'modding' | 'help_choose' | 'support' | 'used_market'

const PAGE_LABELS: Record<PageId, string> = {
  about: 'О нас',
  partnership: 'Партнёрство',
  delivery: 'Доставка',
  modding: 'Моддинг',
  help_choose: 'Помощь с выбором',
  support: 'Поддержка',
  used_market: 'Барахолка',
}

const PAGE_KEYS: Record<PageId, string> = {
  about: 'about_data',
  partnership: 'partnership_data',
  delivery: 'delivery_data',
  modding: 'modding_data',
  help_choose: 'help_choose_data',
  support: 'page_support', // support is text-only for now (no big arrays)
  used_market: 'page_used_market',
}

const PAGE_NEEDS_LANG_SUFFIX = true

// ── Types ──
type Stat = { value: string; label: string }
type Step3 = { num: string; title: string; text: string }
type AboutData = {
  eyebrow?: string
  title?: string
  subtitle?: string
  heroPrimary?: string
  heroSecondary?: string
  polaroidTag?: string
  polaroidTitle?: string
  storyTitle?: string
  storyText?: string
  valuesTitle?: string
  contactLabel?: string
  contactTitle?: string
  contactText?: string
  avitoBtn?: string
  emailBtn?: string
  stats?: Stat[]
  timeline?: Step3[]
  values?: Step3[]
}

type Tier = { id: string; name: string; priceLabel: string; priceNote: string; featured?: boolean; features: string[] }
type PerkRow = { title: string; text: string }
type PartnershipData = {
  eyebrow?: string
  title?: string
  subtitle?: string
  popularBadge?: string
  tierCtaPrimary?: string
  tierCtaSecondary?: string
  perksTitle?: string
  ctaLabel?: string
  ctaText?: string
  telegramBtn?: string
  emailBtn?: string
  tiers?: Tier[]
  perks?: PerkRow[]
}

type FaqRow = { q: string; a: string }
type DeliveryRow = { region: string; text: string }
type PaymentMethod = { name: string; text: string }
type DeliveryData = {
  eyebrow?: string
  title?: string
  subtitle?: string
  statusChip?: string
  timelineTitle?: string
  paymentTitle?: string
  coverageTitle?: string
  faqTitle?: string
  timeline?: Step3[]
  payment?: PaymentMethod[]
  coverage?: DeliveryRow[]
  faq?: FaqRow[]
}

type Service = { id: string; category: 'keyboards' | 'mice'; tag?: string; title: string; desc: string; features: string[]; price: string }
type Bundle = { id: string; savings: string; title: string; desc: string; features: string[]; priceOld: string; priceNew: string; cta: string }
type ProcessStep = { step: string; title: string; text: string }
type ModdingData = {
  eyebrow?: string
  titleStart?: string
  titleAccent?: string
  titleEnd?: string
  subtitle?: string
  processTitle?: string
  bundlesTitle?: string
  bundlesSubtitle?: string
  perks?: PerkRow[]
  processSteps?: ProcessStep[]
  services?: Service[]
  bundles?: Bundle[]
  finalCtaTitle?: string
  finalCtaText?: string
  finalCtaBtn?: string
}

type QuizOption = { id: string; label: string; hint?: string }
type QuizStep = { question: string; options: QuizOption[] }
type HelpChooseData = {
  eyebrow?: string
  title?: string
  subtitle?: string
  resultTitle?: string
  resultText?: string
  resetBtn?: string
  telegramBtn?: string
  supportBtn?: string
  steps?: QuizStep[]
}

type SupportData = {
  eyebrow?: string
  title?: string
  subtitle?: string
  statResponse?: string
  statResponseLabel?: string
}

type UsedMarketData = {
  badge?: string
  title?: string
  lead?: string
  sellBlockTitle?: string
  sellBlockText?: string
  sellBlockAction?: string
  filterAria?: string
  byCondition?: string
  byBrand?: string
  byPrice?: string
  allBrands?: string
  allPrices?: string
  empty?: string
  filteredEmpty?: string
}

type PageData = AboutData | PartnershipData | DeliveryData | ModdingData | HelpChooseData | SupportData | UsedMarketData

function storageKey(page: PageId, lang: 'ru' | 'en'): string {
  return PAGE_NEEDS_LANG_SUFFIX ? `${PAGE_KEYS[page]}_${lang}` : PAGE_KEYS[page]
}

export function PagesTabV2() {
  const [pageId, setPageId] = useState<PageId>('about')
  const [lang, setLang] = useState<'ru' | 'en'>('ru')
  const [data, setData] = useState<PageData>({})
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError('')
    fetchSiteContent<PageData>(storageKey(pageId, lang)).then((result) => {
      setData(result.data ?? {})
      setDirty(false)
      setLoading(false)
    })
  }, [pageId, lang])

  function patch(p: Partial<PageData>) {
    setData((prev) => ({ ...prev, ...p }))
    setDirty(true)
  }

  async function save() {
    if (!dirty) return
    setSaving(true)
    setError('')
    try {
      await updateSiteContent(storageKey(pageId, lang), data)
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
          <h2 className="admin__topbar-title">Контент страниц</h2>
          <div className="admin__page-picker">
            {(Object.keys(PAGE_LABELS) as PageId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={`admin__page-pick ${pageId === id ? 'admin__page-pick--active' : ''}`.trim()}
                onClick={() => setPageId(id)}
                disabled={dirty}
                title={dirty ? 'Сначала сохраните изменения' : ''}
              >
                {PAGE_LABELS[id]}
              </button>
            ))}
          </div>
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
            {dirty ? <>есть несохранённые изменения</> : savedAt ? <>сохранено · {new Date(savedAt).toLocaleTimeString('ru-RU')}</> : <>чисто</>}
          </span>
          {error && <span style={{ color: 'var(--color-main)', fontSize: 13 }}>{error}</span>}
          <button
            type="button"
            className="accordion__btn"
            onClick={() => setPreviewOpen(true)}
            disabled={loading}
          >
            Превью страницы
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

      {loading ? (
        <div className="admin__content-empty"><p className="admin__empty-text">Загрузка...</p></div>
      ) : (
        <>
          {pageId === 'about' && <AboutEditor data={data} onPatch={patch} />}
          {pageId === 'partnership' && <PartnershipEditor data={data as PartnershipData} onPatch={patch} />}
          {pageId === 'delivery' && <DeliveryEditor data={data as DeliveryData} onPatch={patch} />}
          {pageId === 'modding' && <ModdingEditor data={data as ModdingData} onPatch={patch} />}
          {pageId === 'help_choose' && <HelpChooseEditor data={data as HelpChooseData} onPatch={patch} />}
          {pageId === 'support' && <SupportEditor data={data as SupportData} onPatch={patch} />}
          {pageId === 'used_market' && <UsedMarketEditor data={data as UsedMarketData} onPatch={patch} />}
        </>
      )}

      <PreviewModal
        open={previewOpen}
        title={`${PAGE_LABELS[pageId]} — превью`}
        onClose={() => setPreviewOpen(false)}
      >
        <PagePreview pageId={pageId} data={data as Record<string, unknown>} />
      </PreviewModal>
    </div>
  )
}

// ── Universal page preview ──
// Renders the actual frontend page component with the editor's in-memory data
// injected through PageContentOverrideContext. This guarantees the preview
// matches the live site pixel-for-pixel — same components, same CSS, same i18n
// fallback for fields the editor hasn't touched. No more drift between hand-
// crafted preview markup and reality.
const PAGE_COMPONENTS: Record<PageId, ComponentType> = {
  about: AboutPage,
  partnership: PartnershipPage,
  delivery: DeliveryPage,
  modding: ModdingPage,
  help_choose: HelpChoosePage,
  support: SupportPage,
  used_market: UsedMarketPage,
}

function PagePreview({ pageId, data }: { pageId: PageId; data: Record<string, unknown> }) {
  const Component = PAGE_COMPONENTS[pageId]
  // Pages also use legacy text-only overrides for some fields; passing the
  // same object as both `data` and `text` is fine — usePageContent picks
  // whichever resolves to a non-empty string.
  const textFields: Record<string, string> = {}
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'string') textFields[k] = v
  }
  return (
    <PageContentOverrideProvider
      override={{ pageId: pageId as HookPageId, data, text: textFields }}
    >
      <Component />
    </PageContentOverrideProvider>
  )
}

// ── Reusable field components ──
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="admin__field">
      <span className="admin__label">{label}</span>
      <input className="admin__input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

function MultiField({ label, value, onChange, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="admin__field">
      <span className="admin__label">{label}</span>
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

// String list editor (e.g. tier features)
function StringList({ label, items, onChange, placeholder = 'пункт списка', max = 12 }: {
  label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string; max?: number
}) {
  return (
    <div className="admin__field">
      <span className="admin__label">{label}</span>
      <ArrayEditor<{ value: string }>
        items={items.map((v) => ({ value: v }))}
        onChange={(next) => onChange(next.map((n) => n.value))}
        blank={() => ({ value: '' })}
        itemLabel={(i) => `Пункт ${i + 1}`}
        addLabel="+ Добавить пункт"
        max={max}
        renderItem={(item, _, update) => (
          <input
            className="admin__input"
            value={item.value}
            onChange={(e) => update({ value: e.target.value })}
            placeholder={placeholder}
          />
        )}
      />
    </div>
  )
}

// ── Page-specific editors ──
function AboutEditor({ data, onPatch }: { data: AboutData; onPatch: (p: Partial<AboutData>) => void }) {
  const d = data as AboutData
  return (
    <div>
      <AccordionSection title="Hero (шапка страницы)" defaultOpen>
        <Field label="Eyebrow" value={d.eyebrow ?? ''} onChange={(v) => onPatch({ eyebrow: v })} />
        <Field label="Заголовок" value={d.title ?? ''} onChange={(v) => onPatch({ title: v })} />
        <MultiField label="Подзаголовок" value={d.subtitle ?? ''} onChange={(v) => onPatch({ subtitle: v })} />
        <div className="admin__field-grid-2">
          <Field label="Кнопка #1 (текст)" value={d.heroPrimary ?? ''} onChange={(v) => onPatch({ heroPrimary: v })} />
          <Field label="Кнопка #2 (текст)" value={d.heroSecondary ?? ''} onChange={(v) => onPatch({ heroSecondary: v })} />
        </div>
        <Field label="Polaroid: tag" value={d.polaroidTag ?? ''} onChange={(v) => onPatch({ polaroidTag: v })} />
        <Field label="Polaroid: заголовок" value={d.polaroidTitle ?? ''} onChange={(v) => onPatch({ polaroidTitle: v })} />
      </AccordionSection>

      <AccordionSection title="Статистика" count={(d.stats ?? []).length}>
        <ArrayEditor<Stat>
          items={d.stats ?? []}
          onChange={(v) => onPatch({ stats: v })}
          blank={() => ({ value: '', label: '' })}
          itemLabel={(i, item) => `Цифра ${i + 1}${item.value ? ` — ${item.value}` : ''}`}
          addLabel="+ Добавить цифру"
          max={6}
          renderItem={(item, _, update) => (
            <div className="admin__field-grid-2">
              <Field label="Значение" value={item.value} onChange={(v) => update({ value: v })} placeholder="20+" />
              <Field label="Подпись" value={item.label} onChange={(v) => update({ label: v })} placeholder="брендов в каталоге" />
            </div>
          )}
        />
      </AccordionSection>

      <AccordionSection title="Story (как работаем)" count={(d.timeline ?? []).length}>
        <Field label="Заголовок секции" value={d.storyTitle ?? ''} onChange={(v) => onPatch({ storyTitle: v })} />
        <MultiField label="Текст секции" value={d.storyText ?? ''} onChange={(v) => onPatch({ storyText: v })} />
        <ArrayEditor<Step3>
          items={d.timeline ?? []}
          onChange={(v) => onPatch({ timeline: v })}
          blank={() => ({ num: '01', title: '', text: '' })}
          itemLabel={(i, item) => `Шаг ${i + 1}${item.title ? ` — ${item.title}` : ''}`}
          addLabel="+ Добавить шаг"
          max={6}
          renderItem={(item, _, update) => (
            <>
              <div className="admin__field-grid-2">
                <Field label="Номер" value={item.num} onChange={(v) => update({ num: v })} placeholder="01" />
                <Field label="Заголовок" value={item.title} onChange={(v) => update({ title: v })} />
              </div>
              <MultiField label="Текст" rows={2} value={item.text} onChange={(v) => update({ text: v })} />
            </>
          )}
        />
      </AccordionSection>

      <AccordionSection title="Принципы (values)" count={(d.values ?? []).length}>
        <Field label="Заголовок секции" value={d.valuesTitle ?? ''} onChange={(v) => onPatch({ valuesTitle: v })} />
        <ArrayEditor<Step3>
          items={d.values ?? []}
          onChange={(v) => onPatch({ values: v })}
          blank={() => ({ num: '01', title: '', text: '' })}
          itemLabel={(i, item) => `Принцип ${i + 1}${item.title ? ` — ${item.title}` : ''}`}
          addLabel="+ Добавить принцип"
          max={6}
          renderItem={(item, _, update) => (
            <>
              <div className="admin__field-grid-2">
                <Field label="Номер" value={item.num} onChange={(v) => update({ num: v })} />
                <Field label="Заголовок" value={item.title} onChange={(v) => update({ title: v })} />
              </div>
              <MultiField label="Текст" rows={2} value={item.text} onChange={(v) => update({ text: v })} />
            </>
          )}
        />
      </AccordionSection>

      <AccordionSection title="CTA блок">
        <Field label="Eyebrow" value={d.contactLabel ?? ''} onChange={(v) => onPatch({ contactLabel: v })} />
        <Field label="Заголовок" value={d.contactTitle ?? ''} onChange={(v) => onPatch({ contactTitle: v })} />
        <MultiField label="Текст" value={d.contactText ?? ''} onChange={(v) => onPatch({ contactText: v })} />
        <div className="admin__field-grid-2">
          <Field label="Кнопка 1 (Avito)" value={d.avitoBtn ?? ''} onChange={(v) => onPatch({ avitoBtn: v })} />
          <Field label="Кнопка 2 (Email)" value={d.emailBtn ?? ''} onChange={(v) => onPatch({ emailBtn: v })} />
        </div>
      </AccordionSection>
    </div>
  )
}

function PartnershipEditor({ data, onPatch }: { data: PartnershipData; onPatch: (p: Partial<PartnershipData>) => void }) {
  const d = data
  return (
    <div>
      <AccordionSection title="Hero" defaultOpen>
        <Field label="Eyebrow" value={d.eyebrow ?? ''} onChange={(v) => onPatch({ eyebrow: v })} />
        <Field label="Заголовок" value={d.title ?? ''} onChange={(v) => onPatch({ title: v })} />
        <MultiField label="Подзаголовок" value={d.subtitle ?? ''} onChange={(v) => onPatch({ subtitle: v })} />
      </AccordionSection>

      <AccordionSection title="Тарифы партнёрства" count={(d.tiers ?? []).length}>
        <div className="admin__field-grid-2">
          <Field label='Бейдж "популярно"' value={d.popularBadge ?? ''} onChange={(v) => onPatch({ popularBadge: v })} />
          <Field label="Подпись кнопки primary" value={d.tierCtaPrimary ?? ''} onChange={(v) => onPatch({ tierCtaPrimary: v })} />
        </div>
        <Field label="Подпись кнопки secondary" value={d.tierCtaSecondary ?? ''} onChange={(v) => onPatch({ tierCtaSecondary: v })} />
        <ArrayEditor<Tier>
          items={d.tiers ?? []}
          onChange={(v) => onPatch({ tiers: v })}
          blank={() => ({ id: '', name: '', priceLabel: '', priceNote: '', featured: false, features: [] })}
          itemLabel={(i, item) => `Тариф ${i + 1}${item.name ? ` — ${item.name}` : ''}`}
          addLabel="+ Добавить тариф"
          max={6}
          renderItem={(item, _, update) => (
            <>
              <div className="admin__field-grid-2">
                <Field label="ID (slug)" value={item.id} onChange={(v) => update({ id: v })} placeholder="creator / reseller" />
                <Field label="Название" value={item.name} onChange={(v) => update({ name: v })} />
              </div>
              <div className="admin__field-grid-2">
                <Field label="Цена (короткая)" value={item.priceLabel} onChange={(v) => update({ priceLabel: v })} placeholder="от 5 единиц" />
                <Field label="Подпись цены" value={item.priceNote} onChange={(v) => update({ priceNote: v })} />
              </div>
              <label className="admin__field" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <input
                  type="checkbox"
                  checked={!!item.featured}
                  onChange={(e) => update({ featured: e.target.checked })}
                />
                <span className="admin__label" style={{ margin: 0 }}>Выделить как «популярный»</span>
              </label>
              <StringList
                label="Что входит"
                items={item.features ?? []}
                onChange={(v) => update({ features: v })}
                placeholder="оптовые цены от 5 шт."
              />
            </>
          )}
        />
      </AccordionSection>

      <AccordionSection title="Преимущества (perks)" count={(d.perks ?? []).length}>
        <Field label="Заголовок секции" value={d.perksTitle ?? ''} onChange={(v) => onPatch({ perksTitle: v })} />
        <ArrayEditor<PerkRow>
          items={d.perks ?? []}
          onChange={(v) => onPatch({ perks: v })}
          blank={() => ({ title: '', text: '' })}
          itemLabel={(i, item) => `Преимущество ${i + 1}${item.title ? ` — ${item.title}` : ''}`}
          addLabel="+ Добавить"
          max={8}
          renderItem={(item, _, update) => (
            <>
              <Field label="Заголовок" value={item.title} onChange={(v) => update({ title: v })} />
              <MultiField label="Текст" rows={2} value={item.text} onChange={(v) => update({ text: v })} />
            </>
          )}
        />
      </AccordionSection>

      <AccordionSection title="CTA блок">
        <Field label="Eyebrow" value={d.ctaLabel ?? ''} onChange={(v) => onPatch({ ctaLabel: v })} />
        <MultiField label="Текст" value={d.ctaText ?? ''} onChange={(v) => onPatch({ ctaText: v })} />
        <div className="admin__field-grid-2">
          <Field label="Кнопка Telegram (текст)" value={d.telegramBtn ?? ''} onChange={(v) => onPatch({ telegramBtn: v })} />
          <Field label="Кнопка Email (текст)" value={d.emailBtn ?? ''} onChange={(v) => onPatch({ emailBtn: v })} />
        </div>
      </AccordionSection>
    </div>
  )
}

function DeliveryEditor({ data, onPatch }: { data: DeliveryData; onPatch: (p: Partial<DeliveryData>) => void }) {
  const d = data
  return (
    <div>
      <AccordionSection title="Hero" defaultOpen>
        <Field label="Eyebrow" value={d.eyebrow ?? ''} onChange={(v) => onPatch({ eyebrow: v })} />
        <Field label="Заголовок" value={d.title ?? ''} onChange={(v) => onPatch({ title: v })} />
        <MultiField label="Подзаголовок" value={d.subtitle ?? ''} onChange={(v) => onPatch({ subtitle: v })} />
        <Field label="Статус-чип" value={d.statusChip ?? ''} onChange={(v) => onPatch({ statusChip: v })} placeholder="работаем с CDEK" />
      </AccordionSection>

      <AccordionSection title="Таймлайн доставки" count={(d.timeline ?? []).length}>
        <Field label="Заголовок секции" value={d.timelineTitle ?? ''} onChange={(v) => onPatch({ timelineTitle: v })} />
        <ArrayEditor<Step3>
          items={d.timeline ?? []}
          onChange={(v) => onPatch({ timeline: v })}
          blank={() => ({ num: '01', title: '', text: '' })}
          itemLabel={(i, item) => `Шаг ${i + 1}${item.title ? ` — ${item.title}` : ''}`}
          addLabel="+ Добавить шаг"
          max={6}
          renderItem={(item, _, update) => (
            <>
              <div className="admin__field-grid-2">
                <Field label="Номер" value={item.num} onChange={(v) => update({ num: v })} />
                <Field label="Заголовок" value={item.title} onChange={(v) => update({ title: v })} />
              </div>
              <MultiField label="Текст" rows={2} value={item.text} onChange={(v) => update({ text: v })} />
            </>
          )}
        />
      </AccordionSection>

      <AccordionSection title="Способы оплаты" count={(d.payment ?? []).length}>
        <Field label="Заголовок секции" value={d.paymentTitle ?? ''} onChange={(v) => onPatch({ paymentTitle: v })} />
        <ArrayEditor<PaymentMethod>
          items={d.payment ?? []}
          onChange={(v) => onPatch({ payment: v })}
          blank={() => ({ name: '', text: '' })}
          itemLabel={(i, item) => `Способ ${i + 1}${item.name ? ` — ${item.name}` : ''}`}
          addLabel="+ Добавить способ"
          max={8}
          renderItem={(item, _, update) => (
            <>
              <Field label="Название" value={item.name} onChange={(v) => update({ name: v })} placeholder="Тинькофф" />
              <MultiField label="Описание" rows={2} value={item.text} onChange={(v) => update({ text: v })} />
            </>
          )}
        />
      </AccordionSection>

      <AccordionSection title="Сроки по регионам" count={(d.coverage ?? []).length}>
        <Field label="Заголовок секции" value={d.coverageTitle ?? ''} onChange={(v) => onPatch({ coverageTitle: v })} />
        <ArrayEditor<DeliveryRow>
          items={d.coverage ?? []}
          onChange={(v) => onPatch({ coverage: v })}
          blank={() => ({ region: '', text: '' })}
          itemLabel={(i, item) => `Регион ${i + 1}${item.region ? ` — ${item.region}` : ''}`}
          addLabel="+ Добавить регион"
          max={20}
          renderItem={(item, _, update) => (
            <div className="admin__field-grid-2">
              <Field label="Регион" value={item.region} onChange={(v) => update({ region: v })} placeholder="Москва и МО" />
              <Field label="Срок" value={item.text} onChange={(v) => update({ text: v })} placeholder="2-3 дня" />
            </div>
          )}
        />
      </AccordionSection>

      <AccordionSection title="FAQ" count={(d.faq ?? []).length}>
        <Field label="Заголовок секции" value={d.faqTitle ?? ''} onChange={(v) => onPatch({ faqTitle: v })} />
        <ArrayEditor<FaqRow>
          items={d.faq ?? []}
          onChange={(v) => onPatch({ faq: v })}
          blank={() => ({ q: '', a: '' })}
          itemLabel={(i, item) => `Вопрос ${i + 1}${item.q ? ` — ${item.q.slice(0, 40)}` : ''}`}
          addLabel="+ Добавить вопрос"
          max={20}
          renderItem={(item, _, update) => (
            <>
              <Field label="Вопрос" value={item.q} onChange={(v) => update({ q: v })} />
              <MultiField label="Ответ" rows={3} value={item.a} onChange={(v) => update({ a: v })} />
            </>
          )}
        />
      </AccordionSection>
    </div>
  )
}

function ModdingEditor({ data, onPatch }: { data: ModdingData; onPatch: (p: Partial<ModdingData>) => void }) {
  const d = data
  return (
    <div>
      <AccordionSection title="Hero" defaultOpen>
        <Field label="Eyebrow" value={d.eyebrow ?? ''} onChange={(v) => onPatch({ eyebrow: v })} placeholder="кастомизация" />
        <div className="admin__field-grid-2">
          <Field label="Заголовок: начало" value={d.titleStart ?? ''} onChange={(v) => onPatch({ titleStart: v })} placeholder="раскройте" />
          <Field label="Заголовок: акцент" value={d.titleAccent ?? ''} onChange={(v) => onPatch({ titleAccent: v })} placeholder="потенциал" />
        </div>
        <Field label="Заголовок: конец" value={d.titleEnd ?? ''} onChange={(v) => onPatch({ titleEnd: v })} placeholder="своих девайсов." />
        <MultiField label="Подзаголовок" value={d.subtitle ?? ''} onChange={(v) => onPatch({ subtitle: v })} />
      </AccordionSection>

      <AccordionSection title="Преимущества моддинга" count={(d.perks ?? []).length}>
        <ArrayEditor<PerkRow>
          items={d.perks ?? []}
          onChange={(v) => onPatch({ perks: v })}
          blank={() => ({ title: '', text: '' })}
          itemLabel={(i, item) => `Преимущество ${i + 1}${item.title ? ` — ${item.title}` : ''}`}
          addLabel="+ Добавить преимущество"
          max={6}
          renderItem={(item, _, update) => (
            <>
              <Field label="Заголовок" value={item.title} onChange={(v) => update({ title: v })} />
              <MultiField label="Текст" rows={2} value={item.text} onChange={(v) => update({ text: v })} />
            </>
          )}
        />
      </AccordionSection>

      <AccordionSection title="Процесс работы" count={(d.processSteps ?? []).length}>
        <Field label="Заголовок секции" value={d.processTitle ?? ''} onChange={(v) => onPatch({ processTitle: v })} />
        <ArrayEditor<ProcessStep>
          items={d.processSteps ?? []}
          onChange={(v) => onPatch({ processSteps: v })}
          blank={() => ({ step: '', title: '', text: '' })}
          itemLabel={(i, item) => `Шаг ${i + 1}${item.title ? ` — ${item.title}` : ''}`}
          addLabel="+ Добавить шаг"
          max={6}
          renderItem={(item, _, update) => (
            <>
              <div className="admin__field-grid-2">
                <Field label="Подпись (например: шаг 1)" value={item.step} onChange={(v) => update({ step: v })} />
                <Field label="Заголовок" value={item.title} onChange={(v) => update({ title: v })} />
              </div>
              <MultiField label="Текст" rows={2} value={item.text} onChange={(v) => update({ text: v })} />
            </>
          )}
        />
      </AccordionSection>

      <AccordionSection title="Услуги (карточки с ценой)" count={(d.services ?? []).length}>
        <ArrayEditor<Service>
          items={d.services ?? []}
          onChange={(v) => onPatch({ services: v })}
          blank={() => ({ id: '', category: 'keyboards', title: '', desc: '', features: [], price: '' })}
          itemLabel={(i, item) => `Услуга ${i + 1}${item.title ? ` — ${item.title}` : ''}`}
          addLabel="+ Добавить услугу"
          max={20}
          renderItem={(item, _, update) => (
            <>
              <div className="admin__field-grid-2">
                <Field label="ID (slug)" value={item.id} onChange={(v) => update({ id: v })} placeholder="switch-lube" />
                <div className="admin__field">
                  <span className="admin__label">Категория</span>
                  <select
                    className="admin__input"
                    value={item.category}
                    onChange={(e) => update({ category: e.target.value as 'keyboards' | 'mice' })}
                  >
                    <option value="keyboards">клавиатуры</option>
                    <option value="mice">мыши</option>
                  </select>
                </div>
              </div>
              <Field label="Тег (опц.)" value={item.tag ?? ''} onChange={(v) => update({ tag: v })} placeholder="популярно" />
              <Field label="Название" value={item.title} onChange={(v) => update({ title: v })} placeholder="смазка свитчей" />
              <MultiField label="Описание" rows={2} value={item.desc} onChange={(v) => update({ desc: v })} />
              <StringList
                label="Что входит (галочки)"
                items={item.features ?? []}
                onChange={(v) => update({ features: v })}
                placeholder="плавный ход клавиш"
              />
              <Field label="Цена" value={item.price} onChange={(v) => update({ price: v })} placeholder="от 3 000₽" />
            </>
          )}
        />
      </AccordionSection>

      <AccordionSection title="Комплекты (бандлы)" count={(d.bundles ?? []).length}>
        <div className="admin__field-grid-2">
          <Field label="Заголовок секции" value={d.bundlesTitle ?? ''} onChange={(v) => onPatch({ bundlesTitle: v })} />
          <Field label="Подзаголовок секции" value={d.bundlesSubtitle ?? ''} onChange={(v) => onPatch({ bundlesSubtitle: v })} />
        </div>
        <ArrayEditor<Bundle>
          items={d.bundles ?? []}
          onChange={(v) => onPatch({ bundles: v })}
          blank={() => ({ id: '', savings: '', title: '', desc: '', features: [], priceOld: '', priceNew: '', cta: 'заказать' })}
          itemLabel={(i, item) => `Комплект ${i + 1}${item.title ? ` — ${item.title}` : ''}`}
          addLabel="+ Добавить комплект"
          max={6}
          renderItem={(item, _, update) => (
            <>
              <div className="admin__field-grid-2">
                <Field label="ID (slug)" value={item.id} onChange={(v) => update({ id: v })} />
                <Field label="Бейдж (экономия)" value={item.savings} onChange={(v) => update({ savings: v })} placeholder="экономия 500₽" />
              </div>
              <Field label="Название" value={item.title} onChange={(v) => update({ title: v })} />
              <MultiField label="Описание" rows={2} value={item.desc} onChange={(v) => update({ desc: v })} />
              <StringList
                label="Что входит"
                items={item.features ?? []}
                onChange={(v) => update({ features: v })}
              />
              <div className="admin__field-grid-2">
                <Field label="Старая цена" value={item.priceOld} onChange={(v) => update({ priceOld: v })} placeholder="3 000₽" />
                <Field label="Новая цена" value={item.priceNew} onChange={(v) => update({ priceNew: v })} placeholder="2 500₽" />
              </div>
              <Field label="Подпись кнопки CTA" value={item.cta} onChange={(v) => update({ cta: v })} />
            </>
          )}
        />
      </AccordionSection>

      <AccordionSection title="Финальный CTA блок">
        <Field label="Заголовок" value={d.finalCtaTitle ?? ''} onChange={(v) => onPatch({ finalCtaTitle: v })} />
        <MultiField label="Текст" value={d.finalCtaText ?? ''} onChange={(v) => onPatch({ finalCtaText: v })} />
        <Field label="Подпись кнопки" value={d.finalCtaBtn ?? ''} onChange={(v) => onPatch({ finalCtaBtn: v })} />
      </AccordionSection>
    </div>
  )
}

function HelpChooseEditor({ data, onPatch }: { data: HelpChooseData; onPatch: (p: Partial<HelpChooseData>) => void }) {
  const d = data
  return (
    <div>
      <AccordionSection title="Hero" defaultOpen>
        <Field label="Eyebrow" value={d.eyebrow ?? ''} onChange={(v) => onPatch({ eyebrow: v })} />
        <Field label="Заголовок" value={d.title ?? ''} onChange={(v) => onPatch({ title: v })} />
        <MultiField label="Подзаголовок" value={d.subtitle ?? ''} onChange={(v) => onPatch({ subtitle: v })} />
      </AccordionSection>

      <AccordionSection title="Шаги опроса" count={(d.steps ?? []).length}>
        <ArrayEditor<QuizStep>
          items={d.steps ?? []}
          onChange={(v) => onPatch({ steps: v })}
          blank={() => ({ question: '', options: [] })}
          itemLabel={(i, item) => `Шаг ${i + 1}${item.question ? ` — ${item.question.slice(0, 40)}` : ''}`}
          addLabel="+ Добавить шаг"
          max={6}
          renderItem={(item, _, update) => (
            <>
              <Field label="Вопрос" value={item.question} onChange={(v) => update({ question: v })} />
              <div className="admin__field">
                <span className="admin__label">Варианты ответов</span>
                <ArrayEditor<QuizOption>
                  items={item.options ?? []}
                  onChange={(v) => update({ options: v })}
                  blank={() => ({ id: '', label: '', hint: '' })}
                  itemLabel={(i, o) => `Вариант ${i + 1}${o.label ? ` — ${o.label}` : ''}`}
                  addLabel="+ Добавить вариант"
                  max={8}
                  renderItem={(o, _, updateOpt) => (
                    <>
                      <div className="admin__field-grid-2">
                        <Field label="ID" value={o.id} onChange={(v) => updateOpt({ id: v })} placeholder="shooter" />
                        <Field label="Подпись" value={o.label} onChange={(v) => updateOpt({ label: v })} />
                      </div>
                      <Field label="Hint (опц.)" value={o.hint ?? ''} onChange={(v) => updateOpt({ hint: v })} />
                    </>
                  )}
                />
              </div>
            </>
          )}
        />
      </AccordionSection>

      <AccordionSection title="Результат + кнопки">
        <Field label="Заголовок результата" value={d.resultTitle ?? ''} onChange={(v) => onPatch({ resultTitle: v })} />
        <MultiField label="Текст результата" value={d.resultText ?? ''} onChange={(v) => onPatch({ resultText: v })} />
        <div className="admin__field-grid-2">
          <Field label="Кнопка Telegram" value={d.telegramBtn ?? ''} onChange={(v) => onPatch({ telegramBtn: v })} />
          <Field label="Кнопка форма поддержки" value={d.supportBtn ?? ''} onChange={(v) => onPatch({ supportBtn: v })} />
        </div>
        <Field label="Сбросить ответы (подпись)" value={d.resetBtn ?? ''} onChange={(v) => onPatch({ resetBtn: v })} />
      </AccordionSection>
    </div>
  )
}

function UsedMarketEditor({ data, onPatch }: { data: UsedMarketData; onPatch: (p: Partial<UsedMarketData>) => void }) {
  const d = data
  return (
    <div>
      <AccordionSection title="Hero" defaultOpen>
        <Field label="Бейдж" value={d.badge ?? ''} onChange={(v) => onPatch({ badge: v })} />
        <Field label="Заголовок" value={d.title ?? ''} onChange={(v) => onPatch({ title: v })} />
        <MultiField label="Лид" rows={3} value={d.lead ?? ''} onChange={(v) => onPatch({ lead: v })} />
      </AccordionSection>

      <AccordionSection title="Seller block">
        <Field label="Заголовок" value={d.sellBlockTitle ?? ''} onChange={(v) => onPatch({ sellBlockTitle: v })} />
        <MultiField label="Текст" rows={4} value={d.sellBlockText ?? ''} onChange={(v) => onPatch({ sellBlockText: v })} />
        <Field label="Кнопка" value={d.sellBlockAction ?? ''} onChange={(v) => onPatch({ sellBlockAction: v })} />
      </AccordionSection>

      <AccordionSection title="Фильтры и пустые состояния">
        <Field label="Aria label" value={d.filterAria ?? ''} onChange={(v) => onPatch({ filterAria: v })} />
        <div className="admin__field-grid-2">
          <Field label="По состоянию" value={d.byCondition ?? ''} onChange={(v) => onPatch({ byCondition: v })} />
          <Field label="По бренду" value={d.byBrand ?? ''} onChange={(v) => onPatch({ byBrand: v })} />
        </div>
        <div className="admin__field-grid-2">
          <Field label="По цене" value={d.byPrice ?? ''} onChange={(v) => onPatch({ byPrice: v })} />
          <Field label="Все бренды" value={d.allBrands ?? ''} onChange={(v) => onPatch({ allBrands: v })} />
        </div>
        <div className="admin__field-grid-2">
          <Field label="Любая цена" value={d.allPrices ?? ''} onChange={(v) => onPatch({ allPrices: v })} />
          <Field label="Пустой список" value={d.empty ?? ''} onChange={(v) => onPatch({ empty: v })} />
        </div>
        <Field label="Пустой после фильтра" value={d.filteredEmpty ?? ''} onChange={(v) => onPatch({ filteredEmpty: v })} />
      </AccordionSection>
    </div>
  )
}

function SupportEditor({ data, onPatch }: { data: SupportData; onPatch: (p: Partial<SupportData>) => void }) {
  const d = data
  return (
    <div>
      <AccordionSection title="Тексты страницы" defaultOpen>
        <Field label="Eyebrow" value={d.eyebrow ?? ''} onChange={(v) => onPatch({ eyebrow: v })} />
        <Field label="Заголовок" value={d.title ?? ''} onChange={(v) => onPatch({ title: v })} />
        <MultiField label="Подзаголовок" value={d.subtitle ?? ''} onChange={(v) => onPatch({ subtitle: v })} />
        <div className="admin__field-grid-2">
          <Field label="Стат — значение" value={d.statResponse ?? ''} onChange={(v) => onPatch({ statResponse: v })} placeholder="~2 часа" />
          <Field label="Стат — подпись" value={d.statResponseLabel ?? ''} onChange={(v) => onPatch({ statResponseLabel: v })} />
        </div>
      </AccordionSection>
    </div>
  )
}
