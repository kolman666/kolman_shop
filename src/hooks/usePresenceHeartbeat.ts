// Tab-lifetime presence pings. Two flavours:
//
// 1. Heartbeat — POST /api/auth?action=heartbeat every 15s while the tab is
//    visible. Updates auth_users.last_seen_at = NOW().
// 2. Offline — `navigator.sendBeacon('/api/auth?action=offline')` fired the
//    instant the tab is hidden (visibility change / page hide / unload).
//    Server ages last_seen_at by 5 min so the user shows as offline within
//    the next admin polling tick (~4s), no waiting for natural timeout.
//
// On the way back (visibility → visible) we fire an immediate heartbeat so
// the "online" dot lights up without waiting for the 15s interval.

import { useEffect } from 'react'
import { getUser } from '../lib/auth'

const HEARTBEAT_MS = 15_000

const TOKEN_KEY = 'kolman-auth-token'
function readToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) || '' } catch { return '' }
}

// One-shot flag — server tells us when the SQL migration is missing so we can
// stop spamming the endpoint for the rest of the session.
let migrationMissing = false

async function beat(): Promise<void> {
  if (migrationMissing) return
  const token = readToken()
  if (!token) return
  try {
    const r = await fetch('/api/auth?action=heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: '{}',
      keepalive: true,
    })
    if (r.ok) {
      try {
        const body = await r.json() as { ok?: boolean; reason?: string }
        if (body?.reason === 'migration_needed') {
          migrationMissing = true
          // eslint-disable-next-line no-console
          console.warn('[presence] auth_users.last_seen_at column is missing — run the migration in api/auth.js header comment, then NOTIFY pgrst, "reload schema"; in Supabase.')
        }
      } catch { /* ignore body parse */ }
    }
  } catch {
    // Network blip — next tick will retry.
  }
}

// Best-effort "I'm leaving" ping. sendBeacon survives page navigation /
// `beforeunload` whereas fetch does not. Token must travel in the body —
// sendBeacon strips Authorization headers.
function sendOffline(): void {
  if (migrationMissing) return
  const token = readToken()
  if (!token) return
  try {
    const blob = new Blob([JSON.stringify({ token })], { type: 'application/json' })
    const ok = navigator.sendBeacon?.('/api/auth?action=offline', blob)
    if (!ok) {
      // Fallback for environments without sendBeacon (rare). keepalive:true
      // lets the request finish even after the page is gone.
      void fetch('/api/auth?action=offline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        keepalive: true,
      })
    }
  } catch {
    // ignore
  }
}

export function usePresenceHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    if (!getUser()) return
    let timer: number | null = null

    const tickIfVisible = () => {
      if (document.visibilityState === 'visible') void beat()
    }

    // Immediate ping so the dot lights up as soon as the user lands.
    tickIfVisible()
    timer = window.setInterval(tickIfVisible, HEARTBEAT_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Just came back — flash an immediate heartbeat.
        void beat()
      } else {
        // Tab hidden, minimised, or switched. Mark offline NOW so the admin
        // sees the change within one polling cycle instead of after the
        // online window expires.
        sendOffline()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', sendOffline)
    window.addEventListener('beforeunload', sendOffline)

    return () => {
      if (timer !== null) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', sendOffline)
      window.removeEventListener('beforeunload', sendOffline)
      // Logged out / unmounted — also send an offline beacon so the user
      // doesn't linger as "online".
      sendOffline()
    }
  }, [enabled])
}
