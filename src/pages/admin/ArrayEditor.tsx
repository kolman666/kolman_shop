import { useState, type DragEvent, type ReactNode } from 'react'

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
// item with a remove button, plus an "add" button at the bottom. Cards are
// reorderable in three ways:
//   1. drag the ⋮⋮ handle (HTML5 native DnD — no extra dependency)
//   2. ↑ / ↓ arrows in the head
//   3. keyboard: focus a card head, ⌥↑ / ⌥↓ to move
//
// The caller supplies the inner field markup via `renderItem(item, index,
// update)` — `update({ field: newValue })` merges a patch into that item.
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
  // Index of the card currently being dragged. -1 when nothing is dragging.
  const [dragIdx, setDragIdx] = useState<number>(-1)
  const [dropTarget, setDropTarget] = useState<number>(-1)

  function update(index: number, patch: Partial<T>) {
    onChange(items.map((item, i) => i === index ? { ...item, ...patch } : item))
  }
  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index))
  }
  function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    swap(index, target)
  }
  function swap(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return
    const next = items.slice()
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }
  function add() {
    if (max && items.length >= max) return
    onChange([...items, blank()])
  }

  function onDragStart(e: DragEvent<HTMLElement>, index: number) {
    setDragIdx(index)
    e.dataTransfer.effectAllowed = 'move'
    // Setting some data is required by Firefox for the drag to start.
    e.dataTransfer.setData('text/plain', String(index))
  }
  function onDragOver(e: DragEvent<HTMLDivElement>, index: number) {
    if (dragIdx === -1) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dropTarget !== index) setDropTarget(index)
  }
  function onDrop(e: DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault()
    if (dragIdx === -1 || dragIdx === index) return
    swap(dragIdx, index)
    setDragIdx(-1)
    setDropTarget(-1)
  }
  function onDragEnd() {
    setDragIdx(-1)
    setDropTarget(-1)
  }

  return (
    <div className="array-editor">
      {items.length === 0 ? (
        <p className="array-editor__empty">{emptyText}</p>
      ) : (
        <div className="array-editor__list">
          {items.map((item, index) => (
            <div
              key={index}
              className={
                `array-editor__item` +
                (dragIdx === index ? ' array-editor__item--dragging' : '') +
                (dropTarget === index && dragIdx !== index ? ' array-editor__item--drop-target' : '')
              }
              draggable={dragIdx === index}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={(e) => onDrop(e, index)}
              onDragEnd={onDragEnd}
            >
              <div
                className="array-editor__item-head"
                onKeyDown={(e) => {
                  if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); move(index, -1) }
                  if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); move(index, 1) }
                }}
                tabIndex={-1}
              >
                <button
                  type="button"
                  className="array-editor__drag"
                  aria-label="перетащить"
                  title="перетащите, чтобы изменить порядок"
                  draggable
                  onDragStart={(e) => onDragStart(e, index)}
                  onDragEnd={onDragEnd}
                >
                  ⋮⋮
                </button>
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
