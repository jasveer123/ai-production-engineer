export function readUrlParams(keys: readonly string[]): Record<string, string> {
  const search = new URLSearchParams(window.location.search)
  return Object.fromEntries(
    keys.flatMap((key) => (search.has(key) ? [[key, search.get(key)!]] : []))
  )
}

export function writeUrlParams(values: Record<string, string | undefined>) {
  const url = new URL(window.location.href)
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value)
    else url.searchParams.delete(key)
  }
  window.history.replaceState(window.history.state, "", url)
}
