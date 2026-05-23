// localStorage-backed compare list (max 4 items). The catalog adds a small
// "+ к сравнению" toggle on each card; the /compare route renders a table
// of selected products with their specs side-by-side, highlighting cells
// that differ.

const KEY = 'kolman-compare'
const MAX = 4
export const COMPARE_EVENT = 'compare:update'

function read(): number[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : []
  } catch { return [] }
}

function write(list: number[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
    window.dispatchEvent(new Event(COMPARE_EVENT))
  } catch { /* quota / SSR */ }
}

export function getCompare(): number[] { return read() }

export function isInCompare(id: number): boolean {
  return read().includes(id)
}

export function toggleCompare(id: number): boolean {
  const list = read()
  const idx = list.indexOf(id)
  if (idx >= 0) {
    list.splice(idx, 1)
    write(list)
    return false
  }
  if (list.length >= MAX) {
    // Full — replace the oldest to keep the list useful.
    list.shift()
  }
  list.push(id)
  write(list)
  return true
}

export function clearCompare() {
  write([])
}

export const COMPARE_MAX = MAX
