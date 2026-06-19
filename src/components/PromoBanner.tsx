import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSiteContent } from '../lib/siteContent'
import { safeHref } from '../lib/safeUrl'

// Site-wide flash-sale banner with an optional live countdown. Content comes
// from the `promo_banner` site_content key (admin → Промокоды → Баннер акции).
// Hides itself automatically when disabled, empty, or once `until` has passed.

type Banner = {
  enabled?: boolean
  text?: string
  until?: string
  url?: string
  buttonText?: string
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return ''
  const total = Math.floor(ms / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return days > 0
    ? `${days}д ${pad(hours)}:${pad(mins)}:${pad(secs)}`
    : `${pad(hours)}:${pad(mins)}:${pad(secs)}`
}

export default function PromoBanner() {
  const [banner, setBanner] = useState<Banner | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    fetchSiteContent<Banner>('promo_banner').then((r) => {
      if (!cancelled && !r.error && r.data) setBanner(r.data)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!banner?.enabled || !banner.until) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [banner?.enabled, banner?.until])

  if (!banner?.enabled || !banner.text) return null

  const untilMs = banner.until ? Date.parse(banner.until) : NaN
  const remaining = Number.isFinite(untilMs) ? untilMs - now : 0
  // A deadline was set and has passed → hide entirely.
  if (banner.until && remaining <= 0) return null

  const countdown = banner.until ? formatRemaining(remaining) : ''
  const href = banner.url ? safeHref(banner.url) : null

  const inner = (
    <>
      <span className="promo-banner__text">{banner.text}</span>
      {countdown && <span className="promo-banner__timer">{countdown}</span>}
      {href && banner.buttonText && <span className="promo-banner__btn">{banner.buttonText}</span>}
    </>
  )

  return (
    <div className="promo-banner" role="region" aria-label="акция">
      {href
        ? (/^https?:\/\//i.test(href)
            ? <a className="promo-banner__inner" href={href} target="_blank" rel="noopener noreferrer">{inner}</a>
            : <Link className="promo-banner__inner" to={href}>{inner}</Link>)
        : <div className="promo-banner__inner">{inner}</div>}
    </div>
  )
}
