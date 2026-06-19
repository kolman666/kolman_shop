import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { setPromo, validatePromo } from '../lib/promo'

// Captures a `?ref=CODE` referral link: validates the code server-side and
// stores it as the active cart promo so the friend's discount applies at
// checkout. Then strips the param from the URL so it doesn't linger.
export default function ReferralCapture() {
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    const ref = params.get('ref')
    if (!ref) return
    void validatePromo(ref, 0).then((res) => {
      if (res.ok) setPromo(res.promo)
    })
    const next = new URLSearchParams(params)
    next.delete('ref')
    setParams(next, { replace: true })
    // Run once on mount — we only need to capture the initial landing param.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
