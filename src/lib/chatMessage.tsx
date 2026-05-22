// Chat message body helpers.
//
// We piggyback photo attachments onto the existing `messages.body` column
// instead of adding a separate `attachments` schema migration. Photos are
// inlined as `[[photo:data:image/jpeg;base64,…]]` markers. The frontend
// resizes everything to 1024px JPEG before encoding, so a typical photo is
// 200–400 KB; the server cap is 2 MB which fits a handful per message.
//
// The split functions below let the renderer separate text content from
// photo URLs so the bubble can render `<p>` for text and `<button>` thumbs
// for photos — wired to the existing PhotoLightbox component.

import { resizeImageToDataUrl } from './imageResize'

export type ChatBubblePart =
  | { kind: 'text'; text: string }
  | { kind: 'photo'; url: string }

const PHOTO_RE = /\[\[photo:(data:image\/[^\]]+|https?:\/\/[^\]]+)\]\]/g

export function parseChatBody(body: string): ChatBubblePart[] {
  if (!body) return []
  const parts: ChatBubblePart[] = []
  let cursor = 0
  let m: RegExpExecArray | null
  PHOTO_RE.lastIndex = 0
  while ((m = PHOTO_RE.exec(body))) {
    const before = body.slice(cursor, m.index)
    if (before.trim()) parts.push({ kind: 'text', text: before })
    parts.push({ kind: 'photo', url: m[1] })
    cursor = m.index + m[0].length
  }
  const tail = body.slice(cursor)
  if (tail.trim()) parts.push({ kind: 'text', text: tail })
  // If the body was purely photos with no text, still return them.
  if (parts.length === 0 && body.match(PHOTO_RE)) {
    body.match(PHOTO_RE)?.forEach((m2) => {
      const url = m2.replace(/^\[\[photo:/, '').replace(/\]\]$/, '')
      parts.push({ kind: 'photo', url })
    })
  }
  return parts
}

export function extractPhotoUrls(body: string): string[] {
  const urls: string[] = []
  let m: RegExpExecArray | null
  PHOTO_RE.lastIndex = 0
  while ((m = PHOTO_RE.exec(body))) urls.push(m[1])
  return urls
}

// Read a File from a <input type="file"> change event, resize it to a max
// dimension suitable for chat (1024px) at 0.85 quality, and return the
// `[[photo:data:image/jpeg;base64,…]]` marker ready to splice into the
// message body. Returns null on read failure.
export async function fileToPhotoMarker(file: File): Promise<string | null> {
  try {
    if (!file.type.startsWith('image/')) return null
    const dataUrl = await resizeImageToDataUrl(file, { maxSize: 1024, quality: 0.85, mimeType: 'image/jpeg' })
    return `[[photo:${dataUrl}]]`
  } catch {
    return null
  }
}
