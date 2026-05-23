// Admin tab for managing the media library directly: bulk upload, browse,
// delete files. Other tabs reach the same library via <MediaPicker>, but
// this is the central place for cleanup.

import { useEffect, useRef, useState } from 'react'
import { listMedia, uploadMedia, deleteMedia, importExistingMedia, type MediaItem, type ImportResult } from '../../lib/media'
import { IconCopy, IconFolder, IconGlobe, IconImport, IconUpload, IconX } from '../../components/icons/UiIcons'

function fmtSize(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export default function MediaTab() {
  const [items, setItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importInfo, setImportInfo] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const r = await listMedia({ q, limit: 100 })
      setItems(r.items)
      setTotal(r.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { void load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q])

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setError('')
    const uploaded: MediaItem[] = []
    try {
      for (const f of Array.from(files)) {
        const m = await uploadMedia(f)
        uploaded.push(m)
      }
      setItems((prev) => [...uploaded, ...prev])
      setTotal((n) => n + uploaded.length)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function runImport() {
    if (!confirm('Найти все картинки, которые сейчас уже используются на сайте, и добавить их в библиотеку?\n\nФайлы при этом не двигаются — они продолжают грузиться с прежних адресов. Это просто индексация.')) return
    setImporting(true)
    setImportInfo(null)
    setError('')
    try {
      const r = await importExistingMedia()
      setImportInfo(r)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    } finally {
      setImporting(false)
    }
  }

  async function remove(id: number | null) {
    if (id === null) return
    if (!confirm('Удалить файл? Если он используется где-то — там появится «битое» изображение.')) return
    try {
      await deleteMedia(id)
      setItems((prev) => prev.filter((it) => it.id !== id))
      setTotal((n) => Math.max(0, n - 1))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed')
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
    } catch { /* clipboard may be blocked */ }
  }

  return (
    <div className="admin__content-tab admin__content-tab--media">
      <header className="admin__content-tab-head">
        <h2 className="admin__content-title">Медиа</h2>
        <p className="admin__content-subtitle">
          Все загруженные файлы хранятся здесь — их можно вставлять в любую секцию через
          {' '}
          <span className="media-tab__hint-inline">
            <IconFolder size={14} />
            из библиотеки
          </span>
          {' '}
          в полях редактирования.
        </p>
      </header>

      <div className="media-tab__controls">
        <label className={`media-picker__upload ui-icon-btn ${uploading ? 'media-picker__upload--busy' : ''}`.trim()}>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={(e) => void handleFiles(e.target.files)}
            disabled={uploading}
          />
          <IconUpload size={16} />
          <span>{uploading ? 'загружаем…' : 'загрузить файлы'}</span>
        </label>
        <button
          type="button"
          className="ghost-btn ui-icon-btn"
          onClick={() => void runImport()}
          disabled={importing}
          title="Найти все уже используемые на сайте URL-картинки и добавить их в библиотеку"
        >
          <IconImport size={16} />
          <span>{importing ? 'сканируем…' : 'импортировать существующие'}</span>
        </button>
        <input
          type="search"
          placeholder="поиск по alt / пути"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="admin__input"
          style={{ flex: 1, minWidth: 200 }}
        />
        <span className="admin__label-hint">{total} файлов</span>
      </div>

      {importInfo && (
        <div className="media-tab__import-result">
          <strong>Готово.</strong>
          <span>
            Найдено URL-ов: <b>{importInfo.scanned}</b>. Внешних (не из нашего хранилища): <b>{importInfo.external}</b>.
            Добавлено новых: <b>{importInfo.imported}</b>. Уже было в библиотеке: <b>{importInfo.alreadyIndexed}</b>.
          </span>
          {importInfo.sources.length > 0 && (
            <span className="media-tab__import-sources">
              источники: {importInfo.sources.join(', ')}
            </span>
          )}
        </div>
      )}

      {error && <p className="admin__empty-text" style={{ color: 'var(--color-main)' }}>{error}</p>}

      {loading && items.length === 0 ? (
        <p className="admin__empty-text" style={{ padding: 40 }}>Загрузка…</p>
      ) : items.length === 0 ? (
        <div className="admin__content-empty">
          <p className="admin__empty-text">
            Пока ничего не загружено. Прогоните SQL для таблицы <code>media</code> и создайте Storage-бакет <code>public-media</code> — затем загрузите первые файлы кнопкой выше.
          </p>
        </div>
      ) : (
        <div className="media-tab__grid">
          {items.map((it) => (
            <div key={it.id ?? it.path} className="media-tab__cell">
              <div className="media-tab__cell-media">
                {it.mime.startsWith('video/') ? (
                  <video src={it.url} className="media-tab__thumb" muted preload="metadata" />
                ) : (
                  <img src={it.url} alt={it.alt ?? ''} className="media-tab__thumb" loading="lazy" />
                )}
                {it.external && (
                  <span className="media-tab__ext-badge" title="внешний файл (хостится не у нас)">
                    <IconGlobe size={11} />
                    <span>внешний</span>
                  </span>
                )}
              </div>
              <div className="media-tab__cell-meta">
                <span className="media-tab__cell-name">{it.path.split('/').pop()}</span>
                <span className="media-tab__cell-sub">{it.mime} · {fmtSize(it.size)}</span>
              </div>
              <div className="media-tab__cell-actions">
                <button type="button" className="ghost-btn media-tab__btn ui-icon-btn" onClick={() => void copy(it.url)} title="скопировать URL">
                  <IconCopy size={13} />
                  <span>url</span>
                </button>
                <button type="button" className="admin__inbox-delete media-tab__btn" onClick={() => void remove(it.id)} disabled={it.id === null} title="удалить" aria-label="удалить">
                  <IconX size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
