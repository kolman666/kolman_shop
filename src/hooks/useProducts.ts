import { useState, useEffect, useCallback, useMemo } from 'react'
import type { Product } from '../data/products'
import { fetchSupabaseProducts } from '../lib/supabaseProducts'

export function useProducts() {
  const [supabaseProducts, setSupabaseProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchSupabaseProducts()
      setSupabaseProducts(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const handler = () => void load()
    window.addEventListener('admin:update', handler)
    return () => window.removeEventListener('admin:update', handler)
  }, [load])

  const products = useMemo(() => [...supabaseProducts] as Product[], [supabaseProducts])

  return {
    products,
    loading,
    refresh: load,
  }
}
