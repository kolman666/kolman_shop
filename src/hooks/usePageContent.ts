import { useEffect, useState } from 'react'
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

// Reads admin overrides for the page from site_content (`<page>_data_<lang>`
// for the new structured data, falling back to the legacy text-only
// `page_<id>_<lang>` for hero fields). Returns a getter that picks an admin
// override (non-empty string) for the field, otherwise falls back to the i18n
// value at `<namespace>.<field>`.
//
// Example:
//   const get = usePageContent('about', 'about')
//   get('title') // override or t('about.title')
export function usePageContent(pageId: PageId, i18nNamespace: string) {
  const { t, i18n } = useTranslation()
  const [overrides, setOverrides] = useState<Record<string, unknown>>({})

  useEffect(() => {
    let cancelled = false
    const lng = i18n.language.startsWith('en') ? 'en' : 'ru'
    void (async () => {
      // 1. Try the new structured data key (preferred).
      const dataKey = `${DATA_KEY[pageId]}_${lng}`
      const dataResult = await fetchSiteContent<Record<string, unknown>>(dataKey)
      if (!cancelled && dataResult.data && Object.keys(dataResult.data).length > 0) {
        setOverrides(dataResult.data)
        return
      }
      // 2. Fallback to the legacy text-only override.
      const legacy = await fetchSiteContent<Record<string, unknown>>(`page_${pageId}_${lng}`)
      if (cancelled) return
      setOverrides(legacy.data ?? {})
    })()
    return () => { cancelled = true }
  }, [pageId, i18n.language])

  return (field: string): string => {
    const override = overrides[field]
    if (typeof override === 'string' && override.trim()) return override
    return t(`${i18nNamespace}.${field}`)
  }
}

// Returns the raw override object for the page (for callers that need to
// read arrays/objects, not just string fields).
export function usePageData<T extends Record<string, unknown>>(pageId: PageId): Partial<T> {
  const { i18n } = useTranslation()
  const [data, setData] = useState<Partial<T>>({})

  useEffect(() => {
    let cancelled = false
    const lng = i18n.language.startsWith('en') ? 'en' : 'ru'
    void (async () => {
      const dataKey = `${DATA_KEY[pageId]}_${lng}`
      const result = await fetchSiteContent<T>(dataKey)
      if (cancelled) return
      setData(result.data ?? {})
    })()
    return () => { cancelled = true }
  }, [pageId, i18n.language])

  return data
}
