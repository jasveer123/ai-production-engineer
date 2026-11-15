import type { MetadataPair } from "../components/metadata-pairs"

export function pairsToRecord(pairs: MetadataPair[]): Record<string, string> {
  return Object.fromEntries(
    pairs.filter((pair) => pair.key.trim()).map((pair) => [pair.key.trim(), pair.value])
  )
}

export function recordToPairs(record: Record<string, string>): MetadataPair[] {
  return Object.entries(record).map(([key, value]) => ({ key, value }))
}
