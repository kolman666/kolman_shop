// Helpers for rendering presence (online / last seen X ago) from the
// `last_seen_at` timestamp returned by /api/auth?action=lookup.

const ONLINE_WINDOW_MS = 90_000 // tab is alive if it pinged in the last ~90s

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false
  const t = new Date(lastSeenAt).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t < ONLINE_WINDOW_MS
}

// Human-friendly relative time, Russian locale, no seconds.
export function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return 'не заходил'
  const t = new Date(lastSeenAt).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  if (diff < ONLINE_WINDOW_MS) return 'в сети'
  const m = Math.floor(diff / 60_000)
  if (m < 60) return `был ${m} мин назад`
  const h = Math.floor(diff / 3_600_000)
  if (h < 24) return `был ${h} ч назад`
  const d = Math.floor(diff / 86_400_000)
  if (d < 7) return `был ${d} дн назад`
  // Anything older: show the date.
  const date = new Date(lastSeenAt)
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `был ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}
