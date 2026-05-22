// Helpers for rendering presence (online / last seen X ago) from the
// `last_seen_at` timestamp returned by /api/auth?action=lookup.

// Heartbeat fires every 15s while visible; on visibility:hidden the client
// sends an explicit offline beacon. So a 45s window is enough to absorb one
// missed beat without leaving stale "online" labels on the admin's screen.
const ONLINE_WINDOW_MS = 45_000

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false
  const t = new Date(lastSeenAt).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t < ONLINE_WINDOW_MS
}

// Human-friendly relative time, Russian locale, minute precision.
// Examples: "в сети", "был только что", "был 3 мин назад", "был 1 ч 12 мин",
// "был 2 дн 4 ч", "был 12.05.2026 14:30".
export function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return 'не заходил'
  const t = new Date(lastSeenAt).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  if (diff < ONLINE_WINDOW_MS) return 'в сети'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'был только что'
  if (minutes < 60) return `был ${minutes} мин назад`
  const h = Math.floor(diff / 3_600_000)
  const remMin = minutes - h * 60
  if (h < 24) return remMin > 0 ? `был ${h} ч ${remMin} мин назад` : `был ${h} ч назад`
  const d = Math.floor(diff / 86_400_000)
  const remH = h - d * 24
  if (d < 7) return remH > 0 ? `был ${d} дн ${remH} ч назад` : `был ${d} дн назад`
  // Anything older: show the exact date + HH:MM so it's still precise.
  const date = new Date(lastSeenAt)
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `был ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
