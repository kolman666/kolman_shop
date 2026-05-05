export type TelegramErrorBody = {
  error?: string
  detail?: string
}

export class TelegramSendError extends Error {
  status: number
  detail?: string
  constructor(status: number, message: string, detail?: string) {
    super(message)
    this.status = status
    this.detail = detail
  }
}

export async function sendTelegramMessage(text: string): Promise<void> {
  let res: Response
  try {
    res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, parse_mode: 'HTML' }),
    })
  } catch (err) {
    throw new TelegramSendError(0, 'network error', err instanceof Error ? err.message : String(err))
  }

  if (res.ok) return

  let body: TelegramErrorBody = {}
  try {
    body = (await res.json()) as TelegramErrorBody
  } catch {
    // non-JSON response (e.g. HTML page) — likely the API route is missing
  }
  throw new TelegramSendError(res.status, body.error ?? `request failed (${res.status})`, body.detail)
}
