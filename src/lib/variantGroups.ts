export const VARIANT_GROUP_LABELS: Record<string, string> = {
  size: 'Размер',
  color: 'Цвет',
  microswitches: 'Микрики',
  micro_switches: 'Микрики',
  switches: 'Свитчи',
  surface: 'Покрытие',
  connectivity: 'Подключение',
  layout: 'Раскладка',
}

export function variantGroupLabel(name: string): string {
  const key = name.trim().toLowerCase().replace(/\s+/g, '_')
  return VARIANT_GROUP_LABELS[key] ?? name
}

export const VARIANT_GROUP_PRESETS: Array<{ name: string; options: string[] }> = [
  { name: 'Size', options: ['Mini', 'Regular', 'Max'] },
  { name: 'Color', options: ['Black', 'White'] },
  { name: 'Microswitches', options: ['Omron', 'Huano', 'TTC'] },
  { name: 'Switches', options: ['Red', 'Brown', 'Blue'] },
  { name: 'Surface', options: ['Speed', 'Control', 'Balanced'] },
]

