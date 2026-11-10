import { SOURCE_QUIET_AFTER_MS } from "../constants"
import type { IngestToken, StreamState } from "../schemas"

export function getSourceState(
  tokens: IngestToken[] | undefined,
  platform: string,
  now: number = Date.now()
): StreamState {
  const used = (tokens ?? [])
    .filter((token) => !token.revokedAt && token.platform === platform && token.lastUsedAt)
    .map((token) => new Date(token.lastUsedAt!).getTime())
  if (used.length === 0) return "not_set_up"
  return now - Math.max(...used) < SOURCE_QUIET_AFTER_MS ? "receiving" : "silent"
}

export function getSourceLastUsed(
  tokens: IngestToken[] | undefined,
  platform: string
): string | null {
  const used = (tokens ?? [])
    .filter((token) => !token.revokedAt && token.platform === platform && token.lastUsedAt)
    .map((token) => token.lastUsedAt!)
    .sort()
  return used.at(-1) ?? null
}
