// Universal image picker used by every admin field that takes an image URL.
//
// Two ways to add an image:
//   1. Drag-and-drop / click a file → uploads to /api/media → returns the
//      public URL which is dropped into the field.
//   2. Click "из библиотеки" → modal listing every previously uploaded asset,
//      click → URL set.
//
// Also accepts a raw URL (external image) for backwards compatibility — the
// old <ImageField> wraps this component without losing existing data.

import { useEffect, useRef, useState } from 'react'
import { listMedia, uploadMedia, type MediaItem } from '../../lib/media'
import { IconFolder, IconGlobe, IconUpload } from '../icons/UiIcons'

type Props = {
  value: string
  onChange: (url: string) => void
  label?: string
  hint?: string
  /** Allow video uploads in addition to images. */
  accept?: 'image' | 'image+video'
}

export default function MediaPicker({ value, onChange, label, hint, accept = 'image' }: Props) {
  const [showLibrary, setShowLibrary] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const acceptAttr = accept === 'image+video' ? 'image/*,video/*' : 'image/*'

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError('')
    setUploading(true)
    try {
      const m = await uploadMedia(files[0])
      onChange(m.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="media-picker">
      {label && <span className="admin__label">{label}</span>}
      <div className="media-picker__row">
        <input
          type="url"
          className="admin__input"
          placeholder="вставить URL или загрузить файл →"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <label className={`media-picker__upload ui-icon-btn ${uploading ? 'media-picker__upload--busy' : ''}`.trim()}>
          <input
            ref={inputRef}
            type="file"
            accept={acceptAttr}
            onChange={(e) => void handleFiles(e.target.files)}
            disabled={uploading}
          />
          <IconUpload size={16} />
          <span>{uploading ? '…' : 'файл'}</span>
        </label>
        <button
          type="button"
          className="ghost-btn media-picker__lib-btn ui-icon-btn"
          onClick={() => setShowLibrary(true)}
        >
          <IconFolder size={16} />
          <span>из библиотеки</span>
        </button>
      </div>
      {value && (
        <div className="media-picker__preview">
          {/^video\//i.test(guessMimeFromUrl(value)) ? (
            <video src={value} controls className="media-picker__preview-media" />
          ) : (
            <img src={value} alt="" className="media-picker__preview-media" loading="lazy" />
          )}
        </div>
      )}
      {hint && <p className="admin__label-hint">{hint}</p>}
      {error && <p className="admin__label-hint" style={{ color: 'var(--color-main)' }}>{error}</p>}

      {showLibrary && (
        <MediaLibraryModal
          accept={accept}
          onPick={(item) => { onChange(item.url); setShowLibrary(false) }}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  )
}

function guessMimeFromUrl(url: string): string {
  const ext = (url.split('.').pop() ?? '').toLowerCase()
  if (['mp4', 'webm', 'mov'].includes(ext)) return `video/${ext}`
  return `image/${ext}`
}

// ── Library modal ────────────────────────────────────────────────────────
function MediaLibraryModal({
  accept,
  onPick,
  onClose,
}: {
  accept: 'image' | 'image+video'
  onPick: (item: MediaItem) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listMedia({ q, limit: 100 }).then(
      (r) => {
        if (cancelled) return
        const filtered = accept === 'image' ? r.items.filter((it) => it.mime.startsWith('image/')) : r.items
        setItems(filtered)
        setLoading(false)
      },
      (e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'failed')
        setLoading(false)
      },
    )
    return () => { cancelled = true }
  }, [q, accept])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="media-library" role="dialog" aria-modal="true">
      <button type="button" className="media-library__backdrop" onClick={onClose} aria-label="закрыть" />
      <div className="media-library__panel">
        <header className="media-library__head">
          <h3>Библиотека медиа</h3>
          <input
            type="search"
            placeholder="поиск по alt / пути"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="admin__input"
            style={{ flex: 1, marginLeft: 14 }}
          />
          <button type="button" className="customer-modal__close" onClick={onClose} aria-label="закрыть">×</button>
        </header>

        {loading && <p className="admin__empty-text" style={{ padding: 40 }}>Загрузка…</p>}
        {error && <p className="admin__empty-text" style={{ padding: 20, color: 'var(--color-main)' }}>{error}</p>}
        {!loading && items.length === 0 && (
          <p className="admin__empty-text" style={{ padding: 40 }}>
            Пока ничего не загружено. Загружайте файлы через поле выше — они появятся здесь.
          </p>
        )}
        {items.length > 0 && (
          <div className="media-library__grid">
            {items.map((it) => (
              <button
                key={it.id ?? it.path}
                type="button"
                className="media-library__cell"
                onClick={() => onPick(it)}
                title={`${it.alt || it.path} · ${(it.size / 1024).toFixed(0)} KB`}
              >
                <div style={{ position: 'relative' }}>
                  {it.mime.startsWith('video/') ? (
                    <video src={it.url} className="media-library__thumb" muted preload="metadata" />
                  ) : (
                    <img src={it.url} alt={it.alt ?? ''} className="media-library__thumb" loading="lazy" />
                  )}
                  {it.external && (
                    <span className="media-tab__ext-badge media-tab__ext-badge--small" title="внешний файл">
                      <IconGlobe size={11} />
                    </span>
                  )}
                </div>
                <span className="media-library__cell-alt">{it.alt || it.path.split('/').pop()}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
