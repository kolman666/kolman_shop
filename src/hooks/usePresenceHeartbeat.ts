// Tab-lifetime heartbeat. Posts to /api/auth?action=heartbeat every 30s while
// the user has the site open, so the admin chat can show an "online" indicator
// and a "last seen X ago" label. Sends an immediate beat on mount, then
// throttles to one every 30s. Pauses while the tab is hidden (no point
// pretending the user is online if their tab is backgrounded).

import { useEffect } from 'react'
import { getUser } from '../lib/auth'

const HEARTBEAT_MS = 30_000

async function beat(): Promise<void> {
  // We piggyback on the existing bearer token from /api/auth?action=login.
  const token = (() => {
    try { return localStorage.getItem('kolman-auth-token') || '' } catch { return '' }
  })()
  if (!token) return
  try {
    await fetch('/api/auth?action=heartbeat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      // Keep request small + don't bother with a body — endpoint reads
      // the user from the token.
      body: '{}',
      keepalive: true,
    })
  } catch {
    // Network blip — next tick will retry.
  }
}

export function usePresenceHeartbeat(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    if (!getUser()) return
    let timer: number | null = null

    const tick = () => {
      if (document.visibilityState === 'visible') void beat()
    }

    // Initial ping so the user shows online the moment they log in / refresh.
    tick()
    timer = window.setInterval(tick, HEARTBEAT_MS)

    const onVisibility = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (timer !== null) window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled])
}
