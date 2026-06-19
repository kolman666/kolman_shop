// Tiny CSV writer. Excel-friendly (UTF-8 BOM + CRLF + RFC 4180 quoting).
// Used by the admin orders tab to export the currently visible page for
// bookkeeping / Avito reconciliation.

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = typeof v === 'string' ? v : String(v)
  // Neutralize spreadsheet formula injection (CWE-1236). Excel / Sheets /
  // LibreOffice evaluate any cell whose value starts with = + - @ (or a
  // leading tab / CR), so attacker-controlled order fields like
  // `=cmd|'/c calc'!A1` would execute when the admin opens the export. RFC
  // quoting does NOT prevent this — the app still sees the leading `=`. Prefix
  // such cells with a single quote so they render as literal text.
  if (/^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`
  }
  // Wrap if it contains comma, quote, semicolon, or newline. Double internal quotes.
  if (/[",;\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv(rows: Array<Record<string, unknown>>, columns?: string[]): string {
  if (rows.length === 0) return ''
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const header = cols.map(escapeCell).join(',')
  const body = rows.map((r) => cols.map((c) => escapeCell(r[c])).join(',')).join('\r\n')
  // UTF-8 BOM helps Excel detect the encoding correctly.
  return `﻿${header}\r\n${body}\r\n`
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Free the object URL on the next tick — keeping it around just leaks memory.
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
