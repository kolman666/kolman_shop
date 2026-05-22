// Renders a chat message body. Splits text and inline `[[photo:…]]` markers,
// renders text as a paragraph and photos as clickable thumbnails that open
// the shared PhotoLightbox. Used by both the customer chat (ProfilePage) and
// the admin chat (AdminPage) so attachment rendering stays identical.

import { parseChatBody } from '../lib/chatMessage'

type Props = {
  body: string
  onOpenPhoto: (urls: string[], index: number) => void
}

export default function ChatBubbleContent({ body, onOpenPhoto }: Props) {
  const parts = parseChatBody(body)
  if (parts.length === 0) {
    return <p>{body}</p>
  }
  // Collect all photo URLs first so the lightbox can walk between them.
  const allPhotos: string[] = []
  for (const p of parts) if (p.kind === 'photo') allPhotos.push(p.url)

  return (
    <div className="chat-bubble__content">
      {parts.map((p, i) => {
        if (p.kind === 'text') {
          return <p key={i}>{p.text}</p>
        }
        const photoIndex = allPhotos.indexOf(p.url)
        return (
          <button
            key={i}
            type="button"
            className="chat-bubble__photo"
            onClick={() => onOpenPhoto(allPhotos, photoIndex)}
            aria-label="открыть фото"
          >
            <img src={p.url} alt="" loading="lazy" />
          </button>
        )
      })}
    </div>
  )
}
