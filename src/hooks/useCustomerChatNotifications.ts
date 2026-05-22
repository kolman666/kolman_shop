import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  CHAT_NOTIFICATIONS_READ_EVENT,
  CUSTOMER_CHAT_NOTIFICATION_EVENT,
  initializeChatNotificationAudio,
  playChatNotificationSound,
  showBrowserChatNotification,
} from '../lib/chatNotifications'

type ToastState = {
  title: string
  body: string
} | null

type MessageRow = {
  id?: number
  sender?: string
  body?: string
  thread_email?: string
  thread_id?: number | null
}

export function useCustomerChatNotifications(email?: string | null) {
  const normalizedEmail = useMemo(() => (email ?? '').trim().toLowerCase(), [email])
  const [unreadThreadIds, setUnreadThreadIds] = useState<Set<number | string>>(() => new Set())
  const [toast, setToast] = useState<ToastState>(null)

  useEffect(() => {
    const clear = () => {
      setUnreadThreadIds(new Set())
      setToast(null)
    }
    window.addEventListener(CHAT_NOTIFICATIONS_READ_EVENT, clear)
    return () => window.removeEventListener(CHAT_NOTIFICATIONS_READ_EVENT, clear)
  }, [])

  useEffect(() => {
    if (!normalizedEmail) {
      setUnreadThreadIds(new Set())
      setToast(null)
      return
    }

    const handleMessage = (row: MessageRow | null) => {
      if (!row || row.sender !== 'admin') return
      const threadKey = row.thread_id ?? row.id ?? Date.now()
      setUnreadThreadIds((prev) => {
        const next = new Set(prev)
        next.add(threadKey)
        return next
      })
      const nextToast = {
        title: 'Новое сообщение поддержки',
        body: (row.body ?? '').slice(0, 120) || 'Вам ответили в чате.',
      }
      setToast(nextToast)
      window.dispatchEvent(new CustomEvent(CUSTOMER_CHAT_NOTIFICATION_EVENT, { detail: { threadKey } }))
      playChatNotificationSound()
      showBrowserChatNotification(nextToast.title, nextToast.body, `customer-chat-${threadKey}`)
      window.setTimeout(() => {
        setToast((current) => (current?.body === nextToast.body ? null : current))
      }, 4200)
    }

    const sb = supabase
    if (sb) {
      const unlockAudio = () => initializeChatNotificationAudio()
      window.addEventListener('pointerdown', unlockAudio, { once: true })

      const channel = sb
        .channel(`customer-chat-notifications-${normalizedEmail}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `thread_email=eq.${normalizedEmail}`,
          },
          (payload) => handleMessage(payload?.new as MessageRow | null),
        )
        .subscribe()
      return () => {
        void sb.removeChannel(channel)
        window.removeEventListener('pointerdown', unlockAudio)
      }
    }
  }, [normalizedEmail])

  return {
    unreadChats: unreadThreadIds.size,
    toast,
    clear: () => {
      setUnreadThreadIds(new Set())
      setToast(null)
    },
  }
}
