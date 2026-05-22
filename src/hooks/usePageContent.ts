import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchSiteContent } from '../lib/siteContent'

export type PageId = 'about' | 'partnership' | 'support' | 'help_choose' | 'delivery' | 'modding'

// Map admin pageId → site_content base key used for the new structured data.
const DATA_KEY: Record<PageId, string> = {
  about: 'about_data',
  partnership: 'partnership_data',
  delivery: 'delivery_data',
  modding: 'modding_data',
  help_choose: 'help_choose_data',
  support: 'page_support', // support is still text-only
}

// ── Preview override ──
//
// The admin previews need to render the *real* page components with the
// editor's in-memory state, not the data currently in Supabase. This context
// lets a wrapper inject overrides that take precedence over both the fetched
// `*_data_*` blob and the legacy `page_*_*` text-only blob.

type Override = {
  pageId: PageId
  // Full structured data (matches `<page>_data_<lang>` schema).
  data?: Record<string, unknown>
  // Legacy text-only overrides (matches `page_<id>_<lang>` schema).
  text?: Record<string, string>
}

const PageContentOverrideContext = createContext<Override | null>(null)

export function PageContentOverrideProvider({ override, children }: { override: Override; children: ReactNode }) {
  // JSX would force a .tsx extension; keep this file as a hook module.
  return createElement(PageContentOverrideContext.Provider, { value: override }, children)
}

// Reads admin overrides for the page. Resolution order:
//   1. Live preview override from context (if the caller matches the same pageId)
//   2. Structured `<page>_data_<lang>` from site_content
//   3. Legacy text-only `page_<id>_<lang>`
//   4. i18n bundled default
//
// Used both by the live pages (with no override) and by the admin Preview
// modal (which injects the in-memory edit state through the context).
export function usePageContent(pageId: PageId, i18nNamespace: string) {
  const { t, i18n } = useTranslation()
  const override = useContext(PageContentOverrideContext)
  const matchedOverride = override && override.pageId === pageId ? override : null
  const [overrides, setOverrides] = useState<Record<string, unknown>>({})

  useEffect(() => {
    if (matchedOverride) {
      // In preview mode we don't fetch — the editor owns the data.
      return
    }
    let cancelled = false
    const lng = i18n.language.startsWith('en') ? 'en' : 'ru'
    void (async () => {
      const dataKey = `${DATA_KEY[pageId]}_${lng}`
      const dataResult = await fetchSiteContent<Record<string, unknown>>(dataKey)
      if (!cancelled && dataResult.data && Object.keys(dataResult.data).length > 0) {
        setOverrides(dataResult.data)
        return
      }
      const legacy = await fetchSiteContent<Record<string, unknown>>(`page_${pageId}_${lng}`)
      if (cancelled) return
      setOverrides(legacy.data ?? {})
    })()
    return () => { cancelled = true }
  }, [pageId, i18n.language, matchedOverride])

  return (field: string): string => {
    // 1. Live preview takes absolute precedence.
    if (matchedOverride) {
      const fromData = matchedOverride.data?.[field]
      if (typeof fromData === 'string' && fromData.trim()) return fromData
      const fromText = matchedOverride.text?.[field]
      if (typeof fromText === 'string' && fromText.trim()) return fromText
    }
    // 2. Fetched override.
    const fetched = overrides[field]
    if (typeof fetched === 'string' && fetched.trim()) return fetched
    // 3. i18n default.
    return t(`${i18nNamespace}.${field}`)
  }
}

// Same idea but for structured (array/object) page data. The override wins
// outright when set, otherwise the fetched data; the page is responsible for
// merging its own i18n fallback for missing fields.
export function usePageData<T extends Record<string, unknown>>(pageId: PageId): Partial<T> {
  const { i18n } = useTranslation()
  const override = useContext(PageContentOverrideContext)
  const matchedOverride = override && override.pageId === pageId ? override : null
  const [data, setData] = useState<Partial<T>>({})

  useEffect(() => {
    if (matchedOverride) return
    let cancelled = false
    const lng = i18n.language.startsWith('en') ? 'en' : 'ru'
    void (async () => {
      const dataKey = `${DATA_KEY[pageId]}_${lng}`
      const result = await fetchSiteContent<T>(dataKey)
      if (cancelled) return
      setData(result.data ?? {})
    })()
    return () => { cancelled = true }
  }, [pageId, i18n.language, matchedOverride])

  if (matchedOverride && matchedOverride.data) {
    return matchedOverride.data as Partial<T>
  }
  return data
}
