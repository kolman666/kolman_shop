// Brand logo ticker — bullet-proof infinite scroll.
//
// Why the old `.marquee-track` approach kept breaking:
//   - It rendered logos *once* inside a `width: max-content` flex track and
//     animated `translateX(0 → -50%)`. The 50% only loops seamlessly if the
//     CSS perfectly believes the duplicated content takes the same space —
//     any padding rounding, font-load delay or SVG width race made it
//     stutter or hide the first/last items.
//   - The mask-image (transparent edges) further chopped off logos that
//     sat in the fade zone at start/finish.
//
// New approach (this file):
//   - The viewport is a plain `overflow: hidden` flex row.
//   - Inside, ONE animated `.brand-ticker__lane` contains TWO identical
//     `.brand-ticker__track` blocks side by side.
//   - The lane animates `translateX(0)` → `translateX(-50%)` (i.e. exactly
//     one track width). When the first track has slid off-screen, the
//     second track is in its place — pixel-perfect loop, regardless of
//     content width, fonts or images.
//   - No mask. Logos either show fully or are off-screen; no edge-clipping.
//   - Hover pauses the lane.
//
// Items are rendered via the `items` prop. Each entry can be a plain ReactNode
// (a brand SVG) or a `BrandLink` object (admin-managed logo with image+url).

import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export type BrandTickerItem =
  | { kind: 'svg'; key: string; node: ReactNode }
  | { kind: 'image'; name: string; image: string; url: string; external?: boolean }

type Props = {
  items: BrandTickerItem[]
  /** Pixels of inter-item gap. Default 56 (matches the old design). */
  gap?: number
  /** Animation duration in seconds. Default 36. */
  duration?: number
  /** ARIA label for the region wrapper. */
  ariaLabel?: string
}

export default function BrandTicker({ items, gap = 56, duration = 36, ariaLabel = 'brands' }: Props) {
  if (items.length === 0) return null

  return (
    <div className="brand-ticker" aria-label={ariaLabel}>
      <div
        className="brand-ticker__lane"
        style={{ animationDuration: `${duration}s` }}
      >
        {/* Two identical tracks so the lane can translate -50% and loop. */}
        {[0, 1].map((trackIdx) => (
          <ul
            key={trackIdx}
            className="brand-ticker__track"
            style={{ gap: `${gap}px`, paddingRight: `${gap}px` }}
            aria-hidden={trackIdx === 1 ? 'true' : undefined}
          >
            {items.map((it) => (
              <li key={`${trackIdx}-${it.kind === 'svg' ? it.key : it.name}`} className="brand-ticker__item">
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
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  )
}
