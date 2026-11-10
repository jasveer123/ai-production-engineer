import { CONTAINER_HOST, LOCAL_HOSTS } from "../constants"

export function toContainerUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (!LOCAL_HOSTS.includes(parsed.hostname)) return url
    parsed.hostname = CONTAINER_HOST
    return parsed.toString().replace(/\/$/, "")
  } catch {
    return url
  }
}
