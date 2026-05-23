// Helpers for rendering presence (online / last seen X ago) from the
// `last_seen_at` timestamp returned by /api/auth?action=lookup.
//
// All labels go through i18next so language switching on the mobile bottom
// nav / chat header / profile updates the text immediately.

import i18n from '../i18n'

const ONLINE_WINDOW_MS = 45_000

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false
  const t = new Date(lastSeenAt).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t < ONLINE_WINDOW_MS
}

function tr(key: string, fallback: string, vars?: Record<string, string | number>): string {
  try {
    const v = i18n.t(`ui.presence.${key}`, { defaultValue: fallback, ...(vars ?? {}) })
    return typeof v === 'string' ? v : fallback
  } catch { return fallback }
}

export function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return tr('never', 'не заходил')
  const t = new Date(lastSeenAt).getTime()
  if (Number.isNaN(t)) return ''
  const diff = Date.now() - t
  if (diff < ONLINE_WINDOW_MS) return tr('online', 'в сети')
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return tr('justNow', 'был только что')
  if (minutes < 60) return tr('wasMinutesAgo', `был ${minutes} мин назад`, { minutes })
  const h = Math.floor(diff / 3_600_000)
  const remMin = minutes - h * 60
  if (h < 24) {
    if (remMin > 0) return tr('wasHoursMinutesAgo', `был ${h} ч ${remMin} мин назад`, { hours: h, minutes: remMin })
    return tr('wasHoursAgo', `был ${h} ч назад`, { hours: h })
  }
  const d = Math.floor(diff / 86_400_000)
  const remH = h - d * 24
  if (d < 7) {
    if (remH > 0) return tr('wasDaysHoursAgo', `был ${d} дн ${remH} ч назад`, { days: d, hours: remH })
    return tr('wasDaysAgo', `был ${d} дн назад`, { days: d })
  }
  const date = new Date(lastSeenAt)
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  const stamp = `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
  return tr('wasOnDate', `был ${stamp}`, { date: stamp })
}
