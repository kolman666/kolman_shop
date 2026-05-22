export const CHAT_NOTIFICATIONS_READ_EVENT = 'chat:notifications-read'
export const CUSTOMER_CHAT_NOTIFICATION_EVENT = 'chat:customer-notification'

export function markChatNotificationsRead() {
  window.dispatchEvent(new Event(CHAT_NOTIFICATIONS_READ_EVENT))
}

export function playChatNotificationSound() {
  try {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return
    const ctx = new AudioContextCtor()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22)
    gain.connect(ctx.destination)

    const first = ctx.createOscillator()
    first.type = 'sine'
    first.frequency.setValueAtTime(740, ctx.currentTime)
    first.connect(gain)
    first.start(ctx.currentTime)
    first.stop(ctx.currentTime + 0.11)

    const second = ctx.createOscillator()
    second.type = 'sine'
    second.frequency.setValueAtTime(980, ctx.currentTime + 0.1)
    second.connect(gain)
    second.start(ctx.currentTime + 0.1)
    second.stop(ctx.currentTime + 0.23)

    window.setTimeout(() => { void ctx.close().catch(() => undefined) }, 320)
  } catch {
    // Browsers can block audio until the first user gesture. Silent failure is ok.
  }
}

export function showBrowserChatNotification(title: string, body: string, tag: string) {
  try {
    if (!('Notification' in window)) return
    if (Notification.permission === 'default') {
      void Notification.requestPermission()
      return
    }
    if (Notification.permission !== 'granted') return
    new Notification(title, { body, tag })
  } catch {
    // In-app badge/toast is the primary notification path.
  }
}
