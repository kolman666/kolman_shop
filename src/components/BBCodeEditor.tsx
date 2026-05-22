// Tiny BBCode editor for the admin news/article body field.
// A textarea with a toolbar that inserts template snippets at the caret —
// like the way old-school forums let you paste [img]URL[/img] from a button.
// Keeps the source plain text in the DB so it's still easy to grep / migrate.

import { useRef, type ChangeEvent } from 'react'
import { renderBBCode } from '../lib/bbcode'

type Props = {
  value: string
  onChange: (next: string) => void
  rows?: number
  label?: string
  hint?: string
  preview?: boolean
}

type Snippet = {
  label: string
  insert: string
  // index of the caret offset relative to insert start after the snippet is
  // placed (so we land the user inside the [b]…[/b], not at the end)
  caret?: number
  title?: string
}

const SNIPPETS: Snippet[] = [
  { label: 'B', insert: '[b][/b]', caret: 3, title: 'жирный' },
  { label: 'I', insert: '[i][/i]', caret: 3, title: 'курсив' },
  { label: 'U', insert: '[u][/u]', caret: 3, title: 'подчёркнутый' },
  { label: 'красный', insert: '[c][/c]', caret: 3, title: 'акцентный (красный)' },
  { label: 'H', insert: '[h][/h]', caret: 3, title: 'заголовок раздела' },
  { label: 'цитата', insert: '[quote][/quote]', caret: 7, title: 'выделенная цитата' },
  { label: 'фото', insert: '[img]https://[/img]', caret: 5, title: 'вставить фото по URL' },
  { label: 'ссылка', insert: '[url=https://]текст[/url]', caret: 5, title: 'ссылка с текстом' },
  { label: 'список', insert: '[list]\n[*]пункт 1\n[*]пункт 2\n[/list]', title: 'маркированный список' },
]

export default function BBCodeEditor({ value, onChange, rows = 8, label, hint, preview = true }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const insert = (s: Snippet) => {
    const el = ref.current
    const v = value
    if (!el) {
      onChange(v + s.insert)
      return
    }
    const start = el.selectionStart ?? v.length
    const end = el.selectionEnd ?? v.length
    const before = v.slice(0, start)
    const after = v.slice(end)
    // If text is selected, wrap it with the snippet's opening/closing tags
    // when the snippet is a paired tag (has a `[/x]` close in it).
    const closeMatch = s.insert.match(/^\[(.+?)\](?:[^[]*)\[\/\1\]$/)
    if (start !== end && closeMatch) {
      const tag = closeMatch[1].split('=')[0]
      // Use the original [tag=…] opener if present (for [url=…]).
      const opener = s.insert.match(/^\[(.+?)\]/)?.[0] ?? `[${tag}]`
      const closer = `[/${tag}]`
      const selected = v.slice(start, end)
      const next = before + opener + selected + closer + after
      onChange(next)
      // Restore selection so the user can keep editing the wrapped text.
      requestAnimationFrame(() => {
        const newStart = before.length + opener.length
        const newEnd = newStart + selected.length
        el.focus()
        el.setSelectionRange(newStart, newEnd)
      })
      return
    }
    const next = before + s.insert + after
    onChange(next)
    requestAnimationFrame(() => {
      const caret = before.length + (s.caret ?? s.insert.length)
      el.focus()
      el.setSelectionRange(caret, caret)
    })
  }

  const onTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)

  return (
    <div className="bb-editor">
      {label && <label className="admin__label">{label}</label>}
      <div className="bb-editor__toolbar" role="toolbar" aria-label="форматирование">
        {SNIPPETS.map((s) => (
          <button
            key={s.label}
            type="button"
            className="bb-editor__btn"
            onClick={() => insert(s)}
            title={s.title ?? s.label}
          >
            {s.label}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        className="admin__input bb-editor__textarea"
        rows={rows}
        value={value}
        onChange={onTextChange}
        spellCheck={false}
      />
      {hint && <p className="admin__label-hint">{hint}</p>}
      {preview && value.trim() && (
        <details className="bb-editor__preview-wrap">
          <summary>Предпросмотр</summary>
          <div className="news-article__body bb-editor__preview">
            {renderBBCode(value)}
          </div>
        </details>
      )}
    </div>
  )
}
