// Client for /api/media. Used by the admin's MediaPicker component to
// upload new files + browse the existing library.

export type MediaItem = {
  id: number | null
  path: string
  url: string
  mime: string
  size: number
  alt: string | null
  width?: number | null
  height?: number | null
  uploaded_at?: string
  // True when the row was registered from an existing URL (site_content,
  // product gallery, etc.) rather than uploaded to our Storage bucket.
  external?: boolean
}

export type ImportResult = {
  scanned: number
  external: number
  imported: number
  alreadyIndexed: number
  sources: string[]
}

// Walks every place that stores image URLs in the database and registers
// the unique URLs into the `media` table with external=true so they show
// up in the library / picker. Safe to re-run — duplicates are skipped.
export async function importExistingMedia(): Promise<ImportResult> {
  const r = await fetch('/api/media?action=import', {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
  })
  if (!r.ok) {
    const b = await r.json().catch(() => ({}))
    throw new Error((b as { error?: string; hint?: string }).hint || (b as { error?: string }).error || `${r.status}`)
  }
  return r.json() as Promise<ImportResult>
}

function adminHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    ...(extra ?? {}),
    'X-Admin-Secret': sessionStorage.getItem('admin_secret') ?? '',
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('read_failed'))
    r.readAsDataURL(file)
  })
}

export async function listMedia(opts: { q?: string; offset?: number; limit?: number } = {}): Promise<{ items: MediaItem[]; total: number }> {
  const params = new URLSearchParams()
  if (opts.q) params.set('q', opts.q)
  if (opts.offset) params.set('offset', String(opts.offset))
  if (opts.limit) params.set('limit', String(opts.limit))
  const r = await fetch(`/api/media${params.toString() ? `?${params}` : ''}`, { headers: adminHeaders() })
  if (!r.ok) {
    const b = await r.json().catch(() => ({}))
    throw new Error((b as { error?: string }).error ?? `${r.status}`)
  }
  return r.json() as Promise<{ items: MediaItem[]; total: number }>
}

// Upload a single file. Reads to a data URL on the client and posts JSON —
// avoids the Vercel multipart-parsing headache.
export async function uploadMedia(file: File, alt = ''): Promise<MediaItem> {
  const dataUrl = await fileToDataUrl(file)
  const r = await fetch('/api/media', {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      filename: file.name,
      mime: file.type,
      dataUrl,
      alt,
    }),
  })
  if (!r.ok) {
    const b = await r.json().catch(() => ({}))
    const err = (b as { error?: string; detail?: string })
    throw new Error(err.detail || err.error || `${r.status}`)
  }
  return r.json() as Promise<MediaItem>
}

export async function deleteMedia(id: number): Promise<void> {
  const r = await fetch('/api/media', {
    method: 'DELETE',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ id }),
  })
  if (!r.ok) {
    const b = await r.json().catch(() => ({}))
    throw new Error((b as { error?: string }).error ?? `${r.status}`)
  }
}
