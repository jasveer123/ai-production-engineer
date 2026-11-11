export const MONITOR_POLL_MS = 10_000

export const KINDS = [
  {
    value: "http",
    label: "Website is up",
    hint: "Alert when the address stops answering or returns an error.",
  },
  {
    value: "keyword",
    label: "Page has a word",
    hint: "Alert when a word is missing from the page, or appears on it.",
  },
  {
    value: "status",
    label: "Status code",
    hint: "Alert when the address answers with a different code than expected.",
  },
  {
    value: "tcp",
    label: "Port is open",
    hint: "Alert when a server stops accepting connections on a port.",
  },
] as const

export const KIND_LABEL: Record<string, string> = Object.fromEntries(
  KINDS.map((item) => [item.value, item.label])
)

export const INTERVALS = [
  { seconds: 30, label: "30 seconds" },
  { seconds: 60, label: "1 minute" },
  { seconds: 180, label: "3 minutes" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 900, label: "15 minutes" },
  { seconds: 3600, label: "1 hour" },
] as const

export const CONFIRMATIONS = [1, 2, 3, 5] as const

export const STATE_VARIANT = { up: "success", down: "destructive", pending: "default" } as const
export const STATE_LABEL: Record<string, string> = {
  up: "Up",
  down: "Down",
  pending: "Waiting for first check",
}
