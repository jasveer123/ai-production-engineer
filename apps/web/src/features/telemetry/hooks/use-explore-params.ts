import * as React from "react"
import { DEFAULT_RANGE } from "../constants"
import type { ExploreParams } from "../explore-schemas"
import { readUrlParams, writeUrlParams } from "../lib"

const KEYS = ["q", "range", "from", "to"] as const

export function useExploreParams() {
  const [params, setParams] = React.useState<ExploreParams>(() => {
    if (typeof window === "undefined") return { q: "", range: DEFAULT_RANGE }
    const url = readUrlParams(KEYS)
    return { q: url.q ?? "", range: url.range ?? DEFAULT_RANGE, from: url.from, to: url.to }
  })

  const update = React.useCallback((next: Partial<ExploreParams>) => {
    setParams((prev) => {
      const merged = { ...prev, ...next }
      writeUrlParams({ q: merged.q, range: merged.range, from: merged.from, to: merged.to })
      return merged
    })
  }, [])

  return { params, update }
}
