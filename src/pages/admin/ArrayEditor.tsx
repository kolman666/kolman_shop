import { type ReactNode } from 'react'

type ArrayEditorProps<T> = {
  items: T[]
  onChange: (next: T[]) => void
  blank: () => T
  renderItem: (item: T, index: number, update: (patch: Partial<T>) => void) => ReactNode
  itemLabel?: (index: number, item: T) => string
  addLabel?: string
  emptyText?: string
  max?: number
}

// Generic editor for an array of object items. Renders an indexed card per
// item with a remove button, plus an "add" button at the bottom. The caller
// supplies the inner field markup via `renderItem(item, index, update)` —
// `update({ field: newValue })` merges a patch into that item.
export function ArrayEditor<T>({
  items,
  onChange,
  blank,
  renderItem,
  itemLabel = (i) => `Элемент ${i + 1}`,
  addLabel = '+ Добавить',
  emptyText = 'Пусто. Добавьте первый элемент.',
  max,
}: ArrayEditorProps<T>) {
  function update(index: number, patch: Partial<T>) {
    onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item))
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = items.slice()
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onChange(next)
  }
  function add() {
    if (max && items.length >= max) return
    onChange([...items, blank()])
  }

  return (
    <div className="array-editor">
      {items.length === 0 ? (
        <p className="array-editor__empty">{emptyText}</p>
      ) : (
        <div className="array-editor__list">
          {items.map((item, index) => (
            <div key={index} className="array-editor__item">
              <div className="array-editor__item-head">
                <span className="array-editor__item-label">{itemLabel(index, item)}</span>
                <div className="array-editor__item-tools">
                  <button type="button" className="array-editor__move" onClick={() => move(index, -1)} disabled={index === 0} aria-label="вверх">↑</button>
                  <button type="button" className="array-editor__move" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="вниз">↓</button>
                  <button type="button" className="array-editor__remove" onClick={() => remove(index)} aria-label="удалить">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="array-editor__item-body">
                {renderItem(item, index, (patch) => update(index, patch))}
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        className="array-editor__add"
        onClick={add}
        disabled={max ? items.length >= max : false}
      >
        {addLabel}
      </button>
    </div>
  )
}
