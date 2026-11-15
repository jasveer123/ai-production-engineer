import { z } from "zod"
import { HTTP_KINDS, PORT_KINDS } from "./constants"
import type { CreateMonitorRequest, Monitor } from "./schemas"

const IP = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]*:[0-9a-f:]*$/i
const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i
const isHost = (v: string) => HOST.test(v) || IP.test(v)

export const monitorFormSchema = z
  .object({
    kind: z.string(),
    name: z.string().trim().min(1, "Give the monitor a name").max(80),
    pronounceableName: z.string().max(120),
    url: z.string().trim(),
    host: z.string().trim(),
    port: z.string().trim(),
    keyword: z.string().trim().max(200),
    keywordMode: z.string(),
    expectedStatuses: z.array(z.number()),
    udpPayload: z.string().max(1000),
    dnsDomain: z.string().trim(),
    dnsRecordType: z.string(),
    dnsExpected: z.string().trim(),
    method: z.string(),
    headers: z.array(z.object({ name: z.string().trim(), value: z.string() })),
    body: z.string().max(10000),
    followRedirects: z.boolean(),
    keepCookies: z.boolean(),
    basicAuthUser: z.string(),
    basicAuthPassword: z.string(),
    timeoutSeconds: z.number(),
    ipVersion: z.string(),
    verifyTls: z.boolean(),
    intervalSeconds: z.number(),
    confirmationSeconds: z.number(),
    recoverySeconds: z.number(),
    sslExpiryDays: z.number(),
    domainExpiryDays: z.number(),
    maintenanceEnabled: z.boolean(),
    maintenanceFrom: z.string(),
    maintenanceTo: z.string(),
    maintenanceTimezone: z.string(),
    maintenanceWeekdays: z.array(z.number()),
    regions: z.array(z.string()).min(1, "Pick at least one region"),
    metadata: z.array(z.object({ key: z.string().trim(), value: z.string() })),
    escalationPolicyId: z.string(),
  })
  .superRefine((v, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message })
    }
    const http = HTTP_KINDS.includes(v.kind)
    if (http) {
      need(/^https?:\/\/\S+$/i.test(v.url), "url", "Enter an http or https address")
      need(!(v.method === "HEAD" && v.body), "body", "A HEAD request cannot send a body")
    } else need(isHost(v.host), "host", "Enter a host name or IP address")
    if (v.kind === "keyword") {
      need(Boolean(v.keyword), "keyword", "Enter the keyword")
      need(v.method !== "HEAD", "method", "A HEAD request has no body to search")
    }
    if (v.kind === "status")
      need(v.expectedStatuses.length > 0, "expectedStatuses", "Pick at least one status code")
    if (v.kind === "tcp" || v.kind === "udp") need(Boolean(v.port), "port", "Enter the port")
    if (v.port) {
      const port = Number(v.port)
      need(Number.isInteger(port) && port > 0 && port < 65536, "port", "Use a port from 1 to 65535")
    }
    if (v.kind === "dns") {
      need(IP.test(v.host), "host", "Enter the DNS server as an IP address")
      need(isHost(v.dnsDomain), "dnsDomain", "Enter the domain to resolve")
    }
    if (v.sslExpiryDays)
      need(/^https:\/\//i.test(v.url) && http, "sslExpiryDays", "SSL alerts need an https address")
    if (v.maintenanceEnabled) {
      need(v.maintenanceFrom !== v.maintenanceTo, "maintenanceTo", "Start and end must differ")
      need(v.maintenanceWeekdays.length > 0, "maintenanceWeekdays", "Pick at least one day")
    }
    v.headers.forEach((h, i) =>
      need(/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(h.name), `headers.${i}.name`, "Invalid header name")
    )
    v.metadata.forEach((m, i) => need(Boolean(m.key), `metadata.${i}.key`, "Enter a key"))
  })

export type MonitorFormValues = z.infer<typeof monitorFormSchema>

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export function formDefaults(monitor?: Monitor): MonitorFormValues {
  return {
    kind: monitor?.kind ?? "http",
    name: monitor?.name ?? "",
    pronounceableName: monitor?.pronounceableName ?? "",
    url: monitor?.url ?? "",
    host: monitor?.host ?? "",
    port: monitor?.port ? String(monitor.port) : "",
    keyword: monitor?.keyword ?? "",
    keywordMode: monitor?.keywordMode ?? "present",
    expectedStatuses: monitor?.expectedStatuses ?? [200],
    udpPayload: monitor?.udpPayload ?? "",
    dnsDomain: monitor?.dnsDomain ?? "",
    dnsRecordType: monitor?.dnsRecordType ?? "A",
    dnsExpected: monitor?.dnsExpected ?? "",
    method: monitor?.method ?? "GET",
    headers: monitor?.headers ?? [],
    body: monitor?.body ?? "",
    followRedirects: monitor?.followRedirects ?? true,
    keepCookies: monitor?.keepCookies ?? true,
    basicAuthUser: monitor?.basicAuthUser ?? "",
    basicAuthPassword: "",
    timeoutSeconds: monitor?.timeoutSeconds ?? 30,
    ipVersion: monitor?.ipVersion ?? "any",
    verifyTls: monitor?.verifyTls ?? true,
    intervalSeconds: monitor?.intervalSeconds ?? 180,
    confirmationSeconds: monitor?.confirmationSeconds ?? 0,
    recoverySeconds: monitor?.recoverySeconds ?? 180,
    sslExpiryDays: monitor?.sslExpiryDays ?? 0,
    domainExpiryDays: monitor?.domainExpiryDays ?? 0,
    maintenanceEnabled: Boolean(monitor?.maintenance),
    maintenanceFrom: monitor?.maintenance?.from ?? "02:00",
    maintenanceTo: monitor?.maintenance?.to ?? "03:00",
    maintenanceTimezone: monitor?.maintenance?.timezone ?? browserZone(),
    maintenanceWeekdays: monitor?.maintenance?.weekdays ?? [0, 1, 2, 3, 4, 5, 6],
    regions: monitor?.regions ?? ["eu", "us"],
    metadata: monitor?.metadata ?? [],
    escalationPolicyId: monitor?.escalationPolicyId ?? "",
  }
}

const orNull = (v: string) => (v.trim() ? v.trim() : null)

export function toRequest(v: MonitorFormValues, editing: boolean): CreateMonitorRequest {
  const http = HTTP_KINDS.includes(v.kind)
  const password = v.basicAuthPassword ? { basicAuthPassword: v.basicAuthPassword } : {}
  return {
    kind: v.kind,
    name: v.name.trim(),
    pronounceableName: orNull(v.pronounceableName),
    url: http ? v.url.trim() : null,
    host: http ? null : v.host.trim(),
    port: PORT_KINDS.includes(v.kind) && v.port ? Number(v.port) : null,
    keyword: v.kind === "keyword" || v.kind === "udp" ? orNull(v.keyword) : null,
    keywordMode: v.keywordMode,
    expectedStatuses: v.kind === "status" ? v.expectedStatuses : [],
    udpPayload: v.kind === "udp" ? orNull(v.udpPayload) : null,
    dnsDomain: v.kind === "dns" ? orNull(v.dnsDomain) : null,
    dnsRecordType: v.dnsRecordType,
    dnsExpected: v.kind === "dns" ? orNull(v.dnsExpected) : null,
    method: v.method,
    headers: v.headers.filter((h) => h.name),
    body: orNull(v.body),
    followRedirects: v.followRedirects,
    keepCookies: v.keepCookies,
    basicAuthUser: orNull(v.basicAuthUser),
    ...(v.basicAuthUser ? password : editing ? { basicAuthPassword: null } : {}),
    timeoutSeconds: v.timeoutSeconds,
    ipVersion: v.ipVersion,
    verifyTls: v.verifyTls,
    intervalSeconds: v.intervalSeconds,
    confirmationSeconds: v.confirmationSeconds,
    recoverySeconds: v.recoverySeconds,
    sslExpiryDays: http && v.sslExpiryDays ? v.sslExpiryDays : null,
    domainExpiryDays: v.domainExpiryDays || null,
    maintenance: v.maintenanceEnabled
      ? {
          from: v.maintenanceFrom,
          to: v.maintenanceTo,
          timezone: v.maintenanceTimezone,
          weekdays: v.maintenanceWeekdays,
        }
      : null,
    regions: v.regions,
    metadata: v.metadata.filter((m) => m.key),
    escalationPolicyId: v.escalationPolicyId || null,
  }
}
