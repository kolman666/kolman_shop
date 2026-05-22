import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Product } from '../data/products'
import { fetchSupabaseProducts, invalidateProductCache, PRODUCTS_EVENT } from '../lib/supabaseProducts'

export function useProducts() {
  const [supabaseProducts, setSupabaseProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    try {
      const data = await fetchSupabaseProducts(forceRefresh)
      // Always sync state with cache, even when empty — the previous "skip if
      // empty" guard hid genuine empty states. The lib already keeps the last
      // known cache when network fails, so an empty array here really means
      // "no products" rather than "fetch failed".
      setSupabaseProducts(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const adminHandler = () => {
      invalidateProductCache()
      void load(true)
    }
    // Background refresh in supabaseProducts.ts emits PRODUCTS_EVENT after a
    // successful refetch — pull the fresh list into the component so the
    // initial cache-hit render gets upgraded to fresh data.
    const refreshHandler = () => { void load(false) }
    window.addEventListener('admin:update', adminHandler)
    window.addEventListener(PRODUCTS_EVENT, refreshHandler)
    return () => {
      window.removeEventListener('admin:update', adminHandler)
      window.removeEventListener(PRODUCTS_EVENT, refreshHandler)
    }
  }, [load])

  const products = useMemo(() => [...supabaseProducts] as Product[], [supabaseProducts])

  return {
    products,
    loading,
    refresh: () => load(true),
  }
}
