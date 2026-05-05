import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Product } from '../data/products'
import { fetchSupabaseProducts, invalidateProductCache } from '../lib/supabaseProducts'

export function useProducts() {
  const [supabaseProducts, setSupabaseProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (forceRefresh = false) => {
    setLoading(true)
    try {
      const data = await fetchSupabaseProducts(forceRefresh)
      if (data.length > 0) {
        setSupabaseProducts(data)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const handler = () => {
      invalidateProductCache()
      void load(true)
    }
    window.addEventListener('admin:update', handler)
    return () => window.removeEventListener('admin:update', handler)
  }, [load])

  const products = useMemo(() => [...supabaseProducts] as Product[], [supabaseProducts])

  return {
    products,
    loading,
    refresh: () => load(true),
  }
}
