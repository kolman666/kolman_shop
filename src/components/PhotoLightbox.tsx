// Lightweight image lightbox. Click any photo (review attachment, chat
// attachment, etc.) to open it full-screen with prev/next navigation and
// keyboard support. Intentionally dependency-free — a fullscreen viewer is
// ~70 lines of React + CSS, and pulling react-image-lightbox just for this
// would add ~30 KB to the bundle.
//
// Usage:
//   const [lb, setLb] = useState<{ images: string[]; index: number } | null>(null)
//   ...
//   <PhotoLightbox state={lb} onClose={() => setLb(null)} />
//   <img onClick={() => setLb({ images: photos, index: i })} />

import { useEffect, useCallback } from 'react'

export type LightboxState = {
  images: string[]
  index: number
}

type Props = {
  state: LightboxState | null
  onClose: () => void
  onChange?: (next: LightboxState) => void
}

export default function PhotoLightbox({ state, onClose, onChange }: Props) {
  const open = state !== null

  const navigate = useCallback(
    (delta: number) => {
      if (!state) return
      const total = state.images.length
      if (total <= 1) return
      const next = (state.index + delta + total) % total
      onChange?.({ images: state.images, index: next })
    },
    [state, onChange],
  )

  // Keyboard: Esc closes, arrows navigate.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') navigate(-1)
      else if (e.key === 'ArrowRight') navigate(1)
    }
    window.addEventListener('keydown', onKey)
    // Lock page scroll while open.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose, navigate])

  if (!state) return null
  const { images, index } = state
  const current = images[index]
  const hasMany = images.length > 1

  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="фото">
      <button
        type="button"
        className="lightbox__backdrop"
        onClick={onClose}
        aria-label="закрыть"
      />
      <button
        type="button"
        className="lightbox__close"
        onClick={onClose}
        aria-label="закрыть"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>

      {hasMany && (
        <button
          type="button"
          className="lightbox__nav lightbox__nav--prev"
          onClick={(e) => { e.stopPropagation(); navigate(-1) }}
          aria-label="предыдущее"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      <img className="lightbox__image" src={current} alt="" />

      {hasMany && (
        <button
          type="button"
          className="lightbox__nav lightbox__nav--next"
          onClick={(e) => { e.stopPropagation(); navigate(1) }}
          aria-label="следующее"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {hasMany && (
        <div className="lightbox__counter">{index + 1} / {images.length}</div>
      )}
    </div>
  )
}
