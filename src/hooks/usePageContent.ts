import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fetchSiteContent } from '../lib/siteContent'

export type PageId = 'about' | 'partnership' | 'support' | 'help_choose' | 'delivery' | 'modding'

// Reads admin overrides for the page from site_content (`page_<id>_<lang>`).
// Returns a getter that picks the override when it's a non-empty string,
// otherwise falls back to the i18n value at `i18nNamespace.field`.
//
// Example: const get = usePageContent('about', 'about'); get('title') // override or t('about.title')
export function usePageContent(pageId: PageId, i18nNamespace: string) {
  const { t, i18n } = useTranslation()
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const lng = i18n.language.startsWith('en') ? 'en' : 'ru'
    void fetchSiteContent<Record<string, string>>(`page_${pageId}_${lng}`).then((r) => {
      if (cancelled) return
      setOverrides(r.data ?? {})
    })
    return () => { cancelled = true }
  }, [pageId, i18n.language])

  return (field: string): string => {
    const override = overrides[field]
    if (typeof override === 'string' && override.trim()) return override
    return t(`${i18nNamespace}.${field}`)
  }
}
