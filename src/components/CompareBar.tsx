// Sticky bottom-right pill that appears whenever the user has 1+ items in
// their comparison list. Clicking goes to /compare. Hidden in admin /
// when empty / on /compare itself.

import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getCompare, COMPARE_EVENT } from '../lib/compare'

export default function CompareBar() {
  const [count, setCount] = useState(() => getCompare().length)
  const { pathname } = useLocation()

  useEffect(() => {
    const sync = () => setCount(getCompare().length)
    sync()
    window.addEventListener(COMPARE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(COMPARE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  if (count === 0) return null
  if (pathname.startsWith('/admin')) return null
  if (pathname.startsWith('/compare')) return null

  return (
    <Link to="/compare" className="compare-bar" aria-label="перейти к сравнению">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 6h18M3 12h18M3 18h18" />
      </svg>
      сравнение
      <span className="compare-bar__badge">{count}</span>
    </Link>
  )
}
