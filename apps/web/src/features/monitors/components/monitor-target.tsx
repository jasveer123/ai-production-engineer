import type { Monitor } from "../schemas"

interface MonitorTargetProps {
  monitor: Pick<Monitor, "url" | "host" | "port">
}

export function MonitorTarget({ monitor }: MonitorTargetProps) {
  return <>{monitor.url ?? `${monitor.host}:${monitor.port}`}</>
}
