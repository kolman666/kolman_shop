// Brand logo ticker — JS-measured infinite scroll.
//
// History of failed approaches we've tried for this same block:
//   1. CSS `@keyframes marquee` with translateX(-50%) on a `width: max-content`
//      track. Failed on any browser where SVG/font load races caused the
//      content width to change after layout — the loop point misaligned and
//      logos disappeared.
//   2. Dual-track CSS-only marquee. Better but still relied on `width: max-content`
//      working identically across engines — at least one user reported logos
//      vanishing entirely.
//
// This version (ROBUST):
//   - Renders the brand list once inside a `<div>` that we measure with a
//     ResizeObserver. We know its exact pixel width.
//   - A second identical copy sits next to it. The outer track is positioned
//     with explicit `width` in pixels (2× measured) and animated via inline
//     `transform: translate3d(-Xpx, 0, 0)` driven by `requestAnimationFrame`.
//     We do the math ourselves so there are NO browser-side surprises.
//   - When the offset reaches one copy width, we reset to 0 instantly —
//     visually invisible because the second copy is in the first's position.
//   - Pauses on hover. Pauses when offscreen via IntersectionObserver to
//     save CPU on phones.
//   - On a fresh mount we wait 1 frame for images/fonts to settle, then
//     re-measure. If the content width changes later (lazy SVG resolves,
//     font loads), the ResizeObserver re-pegs the loop point.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type BrandTickerItem =
  | { kind: 'svg'; key: string; node: ReactNode }
  | { kind: 'image'; name: string; image: string; url: string; external?: boolean }

type Props = {
  items: BrandTickerItem[]
  /** Pixels per second. Default 60 (~smooth catalog feel). */
  speed?: number
  /** Pixels of gap between items. Default 56. */
  gap?: number
  ariaLabel?: string
}

export default function BrandTicker({ items, speed = 60, gap = 56, ariaLabel = 'brands' }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const copyRef = useRef<HTMLDivElement | null>(null)
  const offsetRef = useRef(0)
  const lastTickRef = useRef<number | null>(null)
  const copyWidthRef = useRef(0)
  const pausedRef = useRef(false)
  const visibleRef = useRef(true)
  const [, force] = useState(0) // bump to trigger a re-render after measure

  // Measure the inner copy width whenever it changes (image loads,
  // font swaps, resize). Stays in sync with reality.
  useLayoutEffect(() => {
    const el = copyRef.current
    if (!el) return
    const update = () => {
      const w = el.getBoundingClientRect().width
      if (w > 0 && w !== copyWidthRef.current) {
        copyWidthRef.current = w
        // Force a re-render so the track's inline `width` updates.
        force((n) => n + 1)
      }
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    // Also re-measure once fonts have finished loading (the Unbounded brand
    // text inside SVGs may take a tick to switch from fallback to web font).
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts
    if (fonts?.ready) fonts.ready.then(update).catch(() => undefined)
    return () => ro.disconnect()
  }, [items])

  // Animation loop. Drives offsetRef → translate3d on the track.
  useEffect(() => {
    let raf = 0
    const step = (now: number) => {
      if (lastTickRef.current === null) lastTickRef.current = now
      const dt = now - lastTickRef.current
      lastTickRef.current = now
      if (!pausedRef.current && visibleRef.current && copyWidthRef.current > 0) {
        offsetRef.current += (speed * dt) / 1000
        if (offsetRef.current >= copyWidthRef.current) {
          offsetRef.current -= copyWidthRef.current
        }
        if (trackRef.current) {
          trackRef.current.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [speed])

  // Pause when offscreen — saves CPU on mobile when ticker scrolls out.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visibleRef.current = e.isIntersecting
          if (e.isIntersecting) lastTickRef.current = null // avoid a big dt jump
        }
      },
      { threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  if (items.length === 0) return null

  const renderItem = (it: BrandTickerItem, copyIdx: number, i: number) => (
    <div key={`${copyIdx}-${i}-${it.kind === 'svg' ? it.key : it.name}`} className="brand-ticker__item">
      {it.kind === 'svg' ? it.node : (
        <Link
          to={it.url}
          target={it.external ? '_blank' : undefined}
          rel={it.external ? 'noopener noreferrer' : undefined}
          aria-label={it.name}
          className="brand-ticker__link"
        >
          {it.image
            ? <img src={it.image} alt={it.name} loading="lazy" decoding="async" />
            : <span>{it.name}</span>}
        </Link>
      )}
    </div>
  )

  const copyWidth = copyWidthRef.current
  return (
    <div
      ref={viewportRef}
      className="brand-ticker"
      aria-label={ariaLabel}
      onMouseEnter={() => { pausedRef.current = true }}
      onMouseLeave={() => { pausedRef.current = false; lastTickRef.current = null }}
      onTouchStart={() => { pausedRef.current = true }}
      onTouchEnd={() => { pausedRef.current = false; lastTickRef.current = null }}
    >
      <div
        ref={trackRef}
        className="brand-ticker__lane"
        style={{
          width: copyWidth > 0 ? `${copyWidth * 2}px` : undefined,
          // Initial translate is 0 — RAF takes over immediately.
          transform: 'translate3d(0,0,0)',
        }}
      >
        <div
          ref={copyRef}
          className="brand-ticker__copy"
          style={{ gap: `${gap}px`, paddingRight: `${gap}px` }}
        >
          {items.map((it, i) => renderItem(it, 0, i))}
        </div>
        <div
          className="brand-ticker__copy"
          style={{ gap: `${gap}px`, paddingRight: `${gap}px` }}
          aria-hidden="true"
        >
          {items.map((it, i) => renderItem(it, 1, i))}
        </div>
      </div>
    </div>
  )
}
