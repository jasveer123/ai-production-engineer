import * as React from "react"

export function useCooldown(seconds: number) {
  const [remaining, setRemaining] = React.useState(0)

  React.useEffect(() => {
    if (remaining <= 0) return
    const timer = setTimeout(() => setRemaining((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [remaining])

  const start = React.useCallback(() => setRemaining(seconds), [seconds])

  return { remaining, start }
}
