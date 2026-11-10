import type { LogFilters } from "../schemas"

export function buildLogQuery({ text, levels, services }: LogFilters): string {
  return [
    levels.length ? `level:${levels.join(",")}` : "",
    services.length ? `service:${services.join(",")}` : "",
    text.trim(),
  ]
    .filter(Boolean)
    .join(" ")
}
