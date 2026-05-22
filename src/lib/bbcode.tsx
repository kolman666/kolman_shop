// Minimal BBCode-like parser used by news articles (and anything else that
// wants light formatting + inline images). Intentionally tiny — no AST, no
// nested handling beyond a single level of inline tags inside a paragraph.
//
// Supported tags:
//   [b]bold[/b]
//   [i]italic[/i]
//   [u]underline[/u]
//   [c]accent (red, var(--color-main))[/c]
//   [url=https://...]anchor text[/url]   /  [url]https://...[/url]
//   [img]https://.../pic.jpg[/img]       — block-level image, full width
//   [quote]callout text[/quote]          — block-level blockquote
//   [h]big heading inside article[/h]
//   [list][*]one[*]two[/list]            — bulleted list
//
// Paragraphs are split on blank lines (matching the previous behaviour of
// NewsArticlePage so existing articles keep rendering).

import type { ReactNode } from 'react'
import { Fragment } from 'react'

type Block =
  | { kind: 'p'; text: string }
  | { kind: 'img'; src: string }
  | { kind: 'quote'; text: string }
  | { kind: 'h'; text: string }
  | { kind: 'list'; items: string[] }

function splitBlocks(input: string): Block[] {
  // Pull out block-level tags first so paragraph splitting doesn't break
  // images that include URLs with newlines after them.
  const blocks: Block[] = []
  let cursor = 0
  const blockRe = /\[(img|quote|h|list)\](.*?)\[\/\1\]/gs
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(input))) {
    const before = input.slice(cursor, m.index)
    if (before.trim()) {
      for (const para of before.split(/\n{2,}/)) {
        if (para.trim()) blocks.push({ kind: 'p', text: para })
      }
    }
    if (m[1] === 'img') blocks.push({ kind: 'img', src: m[2].trim() })
    else if (m[1] === 'quote') blocks.push({ kind: 'quote', text: m[2].trim() })
    else if (m[1] === 'h') blocks.push({ kind: 'h', text: m[2].trim() })
    else if (m[1] === 'list') {
      const items = m[2]
        .split(/\[\*\]/)
        .map((s) => s.trim())
        .filter(Boolean)
      blocks.push({ kind: 'list', items })
    }
    cursor = m.index + m[0].length
  }
  const tail = input.slice(cursor)
  if (tail.trim()) {
    for (const para of tail.split(/\n{2,}/)) {
      if (para.trim()) blocks.push({ kind: 'p', text: para })
    }
  }
  return blocks
}

// Render inline tags inside a text chunk (no nested blocks).
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Inline tags: [b], [i], [u], [c], [url], [url=...]
  const inlineRe = /\[(b|i|u|c)\](.*?)\[\/\1\]|\[url(?:=([^\]]+))?\](.*?)\[\/url\]/gs
  let cursor = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = inlineRe.exec(text))) {
    if (m.index > cursor) {
      nodes.push(<Fragment key={`${keyPrefix}-t${i++}`}>{text.slice(cursor, m.index)}</Fragment>)
    }
    if (m[1]) {
      const tag = m[1]
      const inner = m[2]
      if (tag === 'b') nodes.push(<strong key={`${keyPrefix}-b${i++}`}>{inner}</strong>)
      else if (tag === 'i') nodes.push(<em key={`${keyPrefix}-i${i++}`}>{inner}</em>)
      else if (tag === 'u') nodes.push(<u key={`${keyPrefix}-u${i++}`}>{inner}</u>)
      else if (tag === 'c') nodes.push(<span key={`${keyPrefix}-c${i++}`} style={{ color: 'var(--color-main)' }}>{inner}</span>)
    } else if (m[4]) {
      const href = (m[3] ?? m[4]).trim()
      const label = m[4]
      // Defence in depth against javascript:, vbscript:, data:,
      // protocol-relative `//evil.com`, and other smuggling tricks. Only
      // accept absolute http(s) URLs that URL() can parse cleanly.
      let safe: string | undefined
      try {
        const u = new URL(href)
        if ((u.protocol === 'http:' || u.protocol === 'https:') && href.length <= 2048) {
          safe = u.toString()
        }
      } catch {
        safe = undefined
      }
      if (safe) {
        nodes.push(
          <a key={`${keyPrefix}-a${i++}`} href={safe} target="_blank" rel="noopener noreferrer nofollow">
            {label}
          </a>,
        )
      } else {
        // Unsafe URL — render the link text as plain text so the [url] tag
        // isn't a route around the safelist.
        nodes.push(<Fragment key={`${keyPrefix}-a${i++}`}>{label}</Fragment>)
      }
    }
    cursor = m.index + m[0].length
  }
  if (cursor < text.length) {
    nodes.push(<Fragment key={`${keyPrefix}-t${i++}`}>{text.slice(cursor)}</Fragment>)
  }
  return nodes
}

export function renderBBCode(input: string): ReactNode {
  if (!input) return null
  const blocks = splitBlocks(input)
  return (
    <>
      {blocks.map((block, idx) => {
        const key = `bb-${idx}`
        if (block.kind === 'p') return <p key={key}>{renderInline(block.text, key)}</p>
        if (block.kind === 'img') {
          // Strict: only http(s) URLs parseable by URL() — guards against
          // protocol-relative `//evil.com`, javascript:, data:, etc.
          let safe = ''
          try {
            const u = new URL(block.src)
            if ((u.protocol === 'http:' || u.protocol === 'https:') && block.src.length <= 2048) {
              safe = u.toString()
            }
          } catch { /* ignore */ }
          if (!safe) return null
          return (
            <figure key={key} className="bb-img">
              <img src={safe} alt="" loading="lazy" />
            </figure>
          )
        }
        if (block.kind === 'quote') return <blockquote key={key} className="bb-quote">{renderInline(block.text, key)}</blockquote>
        if (block.kind === 'h') return <h3 key={key} className="bb-h">{renderInline(block.text, key)}</h3>
        if (block.kind === 'list') {
          return (
            <ul key={key} className="bb-list">
              {block.items.map((it, i2) => (
                <li key={`${key}-${i2}`}>{renderInline(it, `${key}-${i2}`)}</li>
              ))}
            </ul>
          )
        }
        return null
      })}
    </>
  )
}
