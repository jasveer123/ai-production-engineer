export const MONITOR_POLL_MS = 10_000

export const ALERT_WHEN = [
  { value: "http", kind: "http", label: "URL becomes unavailable" },
  { value: "keyword:present", kind: "keyword", label: "URL doesn't contain keyword" },
  { value: "keyword:absent", kind: "keyword", label: "URL contains a keyword" },
  { value: "status", kind: "status", label: "URL returns HTTP status other than" },
  { value: "ping", kind: "ping", label: "Host doesn't respond to ping" },
  { value: "tcp", kind: "tcp", label: "TCP port is unavailable" },
  { value: "udp", kind: "udp", label: "UDP port doesn't reply" },
  { value: "smtp", kind: "smtp", label: "SMTP server is unavailable" },
  { value: "pop3", kind: "pop3", label: "POP3 server is unavailable" },
  { value: "imap", kind: "imap", label: "IMAP server is unavailable" },
  { value: "dns", kind: "dns", label: "DNS server doesn't resolve" },
] as const

export const KIND_LABEL: Record<string, string> = {
  http: "Website",
  keyword: "Keyword",
  status: "Status code",
  ping: "Ping",
  tcp: "TCP port",
  udp: "UDP port",
  smtp: "SMTP",
  pop3: "POP3",
  imap: "IMAP",
  dns: "DNS",
}

export const HTTP_KINDS = ["http", "keyword", "status"]
export const PORT_KINDS = ["tcp", "udp", "smtp", "pop3", "imap", "dns"]
export const MAIL_PORTS: Record<string, number> = { smtp: 25, pop3: 110, imap: 143, dns: 53 }

export const HTTP_STATUSES = [
  200, 201, 202, 204, 301, 302, 304, 307, 308, 400, 401, 403, 404, 410, 429, 500, 502, 503, 504,
]

export const INTERVALS = [
  { seconds: 30, label: "30 seconds" },
  { seconds: 45, label: "45 seconds" },
  { seconds: 60, label: "1 minute" },
  { seconds: 120, label: "2 minutes" },
  { seconds: 180, label: "3 minutes" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 600, label: "10 minutes" },
  { seconds: 900, label: "15 minutes" },
  { seconds: 1800, label: "30 minutes" },
]

export const CONFIRMATION_PERIODS = [
  { seconds: 0, label: "Immediate start" },
  { seconds: 5, label: "5 seconds" },
  { seconds: 10, label: "10 seconds" },
  { seconds: 15, label: "15 seconds" },
  { seconds: 30, label: "30 seconds" },
  { seconds: 60, label: "1 minute" },
  { seconds: 120, label: "2 minutes" },
  { seconds: 180, label: "3 minutes" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 600, label: "10 minutes" },
  { seconds: 1800, label: "30 minutes" },
]

export const RECOVERY_PERIODS = [
  { seconds: 0, label: "Immediate recovery" },
  { seconds: 60, label: "1 minute" },
  { seconds: 180, label: "3 minutes" },
  { seconds: 300, label: "5 minutes" },
  { seconds: 900, label: "15 minutes" },
  { seconds: 1800, label: "30 minutes" },
  { seconds: 3600, label: "1 hour" },
  { seconds: 7200, label: "2 hours" },
]

export const TIMEOUTS = [2, 3, 5, 10, 15, 30, 45, 60, 90, 120, 180]

export const EXPIRY_ALERTS = [
  { days: 0, label: "Don't check" },
  { days: 1, label: "1 day before" },
  { days: 2, label: "2 days before" },
  { days: 3, label: "3 days before" },
  { days: 7, label: "7 days before" },
  { days: 14, label: "14 days before" },
  { days: 30, label: "1 month before" },
  { days: 60, label: "2 months before" },
]

export const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "OPTIONS"]
export const IP_VERSIONS = [
  { value: "any", label: "Both IPv4 and IPv6" },
  { value: "v4", label: "IPv4 only" },
  { value: "v6", label: "IPv6 only" },
]
export const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "NS", "TXT"]
export const REGIONS = [
  { value: "eu", label: "Europe" },
  { value: "us", label: "North America" },
  { value: "asia", label: "Asia" },
  { value: "au", label: "Australia" },
]
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const PERIOD_LABEL: Record<string, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "365d": "Last 365 days",
}

export const STATE_VARIANT = { up: "success", down: "destructive", pending: "default" } as const
export const STATE_LABEL: Record<string, string> = {
  up: "Up",
  down: "Down",
  pending: "Waiting for first check",
}

export const SELECT_CLASS =
  "h-10 w-full border border-line-strong bg-panel-2 px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-brand/40"
