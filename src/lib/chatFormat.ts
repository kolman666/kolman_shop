// Shared chat-time formatting helpers. Both admin and customer chat tabs
// previously rendered timestamps via `toLocaleString('ru-RU')`, which includes
// seconds AND the full DD.MM.YYYY date even when the message was sent today.
// That made the chat bubbles noisy and stretched the layout. These helpers
// keep timestamps to HH:MM for messages from today, and DD.MM HH:MM otherwise
// (no year, no seconds).

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function formatChatTime(iso: string | Date | undefined | null): string {
  if (!iso) return ''
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (isSameDay(d, new Date())) return hhmm
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${hhmm}`
}

export function formatThreadTime(iso: string | Date | undefined | null): string {
  // Same as formatChatTime — kept as a separate export so future tweaks to
  // sidebar formatting don't have to touch bubble formatting.
  return formatChatTime(iso)
}
