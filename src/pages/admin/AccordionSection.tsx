import { useState, type ReactNode } from 'react'

type AccordionSectionProps = {
  title: string
  description?: string
  defaultOpen?: boolean
  dirty?: boolean
  count?: number
  actions?: ReactNode
  children: ReactNode
}

// WordPress-style collapsible block. Each section keeps its own open/closed
// state; the dirty dot is driven by the parent so the user can see at a glance
// which sections have unsaved changes.
export function AccordionSection({
  title,
  description,
  defaultOpen = false,
  dirty = false,
  count,
  actions,
  children,
}: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={`accordion ${open ? 'accordion--open' : ''}`.trim()}>
      <header className="accordion__head">
        <button
          type="button"
          className="accordion__toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <svg className="accordion__chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
          <span className="accordion__title">{title}</span>
          {typeof count === 'number' && <span className="accordion__count">{count}</span>}
          {dirty && <span className="accordion__dot" title="несохранённые изменения" />}
        </button>
        {actions && <div className="accordion__actions">{actions}</div>}
      </header>
      {description && open && <p className="accordion__desc">{description}</p>}
      {open && <div className="accordion__body">{children}</div>}
    </section>
  )
}
