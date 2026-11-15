import type { Monitor } from "../schemas"

interface MonitorTargetProps {
  monitor: Pick<Monitor, "kind" | "url" | "host" | "port" | "dnsDomain" | "dnsRecordType">
}

export function MonitorTarget({ monitor }: MonitorTargetProps) {
  if (monitor.url) return <>{monitor.url}</>
  if (monitor.kind === "dns")
    return <>{`${monitor.dnsDomain} ${monitor.dnsRecordType} @${monitor.host}`}</>
  return <>{monitor.port ? `${monitor.host}:${monitor.port}` : monitor.host}</>
}
