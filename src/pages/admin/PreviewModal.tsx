import { useEffect, useState, type ReactNode } from 'react'

type PreviewModalProps = {
  open: boolean
  title?: string
  onClose: () => void
  children: ReactNode
}

// Generic full-screen preview overlay. Renders the actual frontend component
// passed as children inside a constrained "stage" so the admin sees an
// accurate preview without leaving the panel.
export function PreviewModal({ open, title = 'Превью', onClose, children }: PreviewModalProps) {
  // Two-state mount so the closing tween can play before unmount —
  // matches the AccountPopover + AuthModal pattern.
  const [mounted, setMounted] = useState(open)
  const [phase, setPhase] = useState<'open' | 'closing'>('open')

  useEffect(() => {
    if (open) {
      setMounted(true)
      requestAnimationFrame(() => setPhase('open'))
      return
    }
    if (!mounted) return
    setPhase('closing')
    const t = window.setTimeout(() => setMounted(false), 220)
    return () => window.clearTimeout(t)
  }, [open, mounted])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!mounted) return null

  return (
    <div className={`preview-modal preview-modal--${phase}`} role="dialog" aria-modal="true">
      <div className="preview-modal__overlay" onClick={onClose} />
      <div className="preview-modal__shell">
        <header className="preview-modal__head">
          <h3 className="preview-modal__title">{title}</h3>
          <button type="button" className="preview-modal__close" onClick={onClose} aria-label="закрыть">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </header>
        <div className="preview-modal__stage">
          <div className="preview-modal__inner">{children}</div>
        </div>
      </div>
    </div>
  )
}
