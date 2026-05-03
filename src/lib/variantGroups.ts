import type { VariantGroup } from '../data/products'

const VARIANT_GROUP_LABELS: Record<string, string> = {
  size: 'Размер',
  color: 'Цвет',
  microswitches: 'Микрики',
  switches: 'Свитчи',
  surface: 'Покрытие',
  connectivity: 'Подключение',
  layout: 'Раскладка',
}

export function normalizeVariantKey(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '_')
}

export function variantGroupLabelByKey(key: string): string {
  return VARIANT_GROUP_LABELS[normalizeVariantKey(key)] ?? key
}

export function variantGroupLabel(nameOrKey: string): string {
  return variantGroupLabelByKey(nameOrKey)
}

export function normalizeVariantGroups(input: unknown): VariantGroup[] {
  if (!Array.isArray(input)) return []
  const out: VariantGroup[] = []

  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>

    const legacyName = typeof row.name === 'string' ? row.name : ''
    const keyRaw = typeof row.key === 'string' ? row.key : legacyName
    const key = normalizeVariantKey(keyRaw)
    if (!key) continue

    const labelRaw = typeof row.label === 'string' ? row.label.trim() : ''
    const label = labelRaw || variantGroupLabelByKey(key)

    const options = Array.isArray(row.options)
      ? row.options.filter((o): o is string => typeof o === 'string').map((o) => o.trim()).filter(Boolean)
      : []

    out.push({ key, label, name: key, options })
  }

  return out
}

export const VARIANT_GROUP_PRESETS: VariantGroup[] = [
  { key: 'size', name: 'size', label: 'Размер', options: ['Mini', 'Regular', 'Max'] },
  { key: 'color', name: 'color', label: 'Цвет', options: ['Black', 'White'] },
  { key: 'microswitches', name: 'microswitches', label: 'Микрики', options: ['Omron', 'Huano', 'TTC'] },
  { key: 'switches', name: 'switches', label: 'Свитчи', options: ['Red', 'Brown', 'Blue'] },
  { key: 'surface', name: 'surface', label: 'Покрытие', options: ['Speed', 'Control', 'Balanced'] },
]
