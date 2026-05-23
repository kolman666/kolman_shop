// Telegram-style delivery indicator that lives next to the timestamp on the
// sender's own messages. Four states:
//
//   sending  – ⏱  the request is in flight (optimistic placeholder)
//   failed   – ⚠  the request errored; clicking the icon retries
//   sent     – ✓  the server stored the message, but the peer hasn't read it
//   read     – ✓✓ the peer's last_seen_at on the thread is past this message
//
// We only render the icon for messages *the current user sent*. The styles
// live alongside `.profile-chat__bubble-foot` in App.css.

export type ChatStatus = 'sending' | 'failed' | 'sent' | 'read'

export default function ChatStatusIcon({
  status,
  onRetry,
}: {
  status: ChatStatus
  onRetry?: () => void
}) {
  const cls = `chat-status chat-status--${status}`

  if (status === 'sending') {
    return (
      <span className={cls} aria-label="отправляется">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </span>
    )
  }

  if (status === 'failed') {
    return (
      <button
        type="button"
        className={`${cls} chat-status--retry`}
        title="не отправилось, нажмите чтобы повторить"
        aria-label="повторить"
        onClick={onRetry}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </button>
    )
  }

  // Sent / read share the same double-check shape; "read" colors it accent-red.
  if (status === 'read') {
    return (
      <span className={cls} aria-label="прочитано">
        <svg width="16" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2 10 7 15 14 4" />
          <polyline points="10 10 15 15 22 4" />
        </svg>
      </span>
    )
  }

  // status === 'sent' — single check
  return (
    <span className={cls} aria-label="отправлено">
      <svg width="14" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 10 10 16 20 4" />
      </svg>
    </span>
  )
}
