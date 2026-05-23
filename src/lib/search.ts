// Lightweight fuzzy search for the header autocomplete.
//
// We score each candidate against the query using three signals:
//   1. exact substring match (best — also covers prefix match)
//   2. bigram Jaccard overlap (typo-tolerant)
//   3. starts-with bonus (boosts brand/product name matches)
//
// Russian-friendly: we lowercase via `toLocaleLowerCase('ru')` so cyrillic
// uppercase doesn't break match. The bigram set ignores spaces so multi-word
// queries still overlap with multi-word product names.
//
// Returns scored items sorted high → low. Filter the result by `score > 0`
// before rendering.

export type Scorable = {
  // Composite haystack of strings to search through. Examples: product
  // brand + title + tags. Order/weight doesn't matter — they're flattened.
  haystack: string[]
}

function normalise(s: string): string {
  return s
    .toLocaleLowerCase('ru')
    .replace(/[ё]/g, 'е')
    .replace(/[^a-zа-я0-9\s/-]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function bigrams(s: string): Set<string> {
  const cleaned = s.replace(/\s+/g, '')
  const set = new Set<string>()
  for (let i = 0; i < cleaned.length - 1; i++) {
    set.add(cleaned.slice(i, i + 2))
  }
  return set
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const uni = a.size + b.size - inter
  return uni === 0 ? 0 : inter / uni
}

// Score an item against a normalised query. Returns 0..1 (with bonuses).
export function fuzzyScore(item: Scorable, normalisedQuery: string, queryBigrams: Set<string>): number {
  if (!normalisedQuery) return 0
  let best = 0
  for (const raw of item.haystack) {
    if (!raw) continue
    const candidate = normalise(raw)
    if (!candidate) continue
    // 1. substring hit — strong signal
    if (candidate.includes(normalisedQuery)) {
      const positionPenalty = candidate.indexOf(normalisedQuery) === 0 ? 0 : 0.1
      const lengthBonus = Math.min(0.2, normalisedQuery.length / candidate.length / 2)
      const score = 1 - positionPenalty + lengthBonus
      if (score > best) best = score
      continue
    }
    // 2. bigram fuzzy match
    const candBigrams = bigrams(candidate)
    const overlap = jaccard(queryBigrams, candBigrams)
    if (overlap > best) best = overlap
  }
  return best
}

// Convenience wrapper that builds the query bigrams once and runs the scorer
// across an array of `{ id, …scorable }` items.
export function fuzzySearch<T extends Scorable>(items: T[], query: string, limit = 8): T[] {
  const q = normalise(query)
  if (!q || q.length < 2) return []
  const qb = bigrams(q)
  const scored = items
    .map((it) => ({ it, s: fuzzyScore(it, q, qb) }))
    .filter((x) => x.s > 0.18) // 0.18 threshold cuts loose matches
  scored.sort((a, b) => b.s - a.s)
  return scored.slice(0, limit).map((x) => x.it)
}
