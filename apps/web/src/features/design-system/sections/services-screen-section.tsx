import { ArrowUpRight, Search } from "lucide-react"
import {
  Badge,
  Button,
  Chip,
  Eyebrow,
  Input,
  Status,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui"
import { MiniBars } from "@/components/shared"
import { Section } from "../components"

type ServiceState = "live" | "waiting" | "failed"

interface ServiceRow {
  name: string
  environment: string
  source: string
  state: ServiceState
  stateLabel: string
  logs: string
  errors: string
  errorsHot: boolean
  problem: string | null
  value: string
  last: string
  bars: number[]
}

const SERVICES: ServiceRow[] = [
  {
    name: "checkout-service",
    environment: "production",
    source: "Kubernetes",
    state: "failed",
    stateLabel: "Problem",
    logs: "48,210",
    errors: "312",
    errorsHot: true,
    problem: "Payment request timed out",
    value: "$1,800",
    last: "2s ago",
    bars: [4, 5, 4, 6, 5, 7, 6, 8, 7, 9, 12, 20, 34, 41, 38, 30, 22, 18, 15, 14, 12, 11, 10, 9],
  },
  {
    name: "payment-service",
    environment: "production",
    source: "Kubernetes",
    state: "failed",
    stateLabel: "Problem",
    logs: "21,904",
    errors: "205",
    errorsHot: true,
    problem: "Card gateway returned 502",
    value: "$2,400",
    last: "3s ago",
    bars: [3, 3, 4, 3, 4, 4, 5, 4, 5, 6, 9, 16, 28, 33, 29, 21, 15, 12, 10, 9, 8, 8, 7, 7],
  },
  {
    name: "frontend",
    environment: "production",
    source: "Kubernetes",
    state: "live",
    stateLabel: "Receiving",
    logs: "96,552",
    errors: "18",
    errorsHot: false,
    problem: null,
    value: "$900",
    last: "1s ago",
    bars: [
      10, 11, 12, 12, 14, 13, 15, 16, 15, 17, 18, 17, 16, 18, 19, 18, 17, 16, 15, 16, 15, 14, 13,
      12,
    ],
  },
  {
    name: "search-api",
    environment: "production",
    source: "Docker",
    state: "live",
    stateLabel: "Receiving",
    logs: "30,118",
    errors: "4",
    errorsHot: false,
    problem: null,
    value: "$600",
    last: "4s ago",
    bars: [6, 6, 7, 7, 8, 8, 9, 9, 8, 8, 9, 10, 9, 9, 10, 9, 8, 8, 7, 7, 7, 6, 6, 6],
  },
  {
    name: "email-worker",
    environment: "production",
    source: "Docker",
    state: "waiting",
    stateLabel: "Quiet 22m",
    logs: "1,044",
    errors: "0",
    errorsHot: false,
    problem: null,
    value: "$150",
    last: "22m ago",
    bars: [3, 3, 3, 4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    name: "nightly-report",
    environment: "staging",
    source: "Python",
    state: "waiting",
    stateLabel: "Quiet 3h",
    logs: "212",
    errors: "1",
    errorsHot: false,
    problem: null,
    value: "-",
    last: "3h ago",
    bars: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
]

const KPIS = [
  { label: "Services connected", value: "14", note: "from 3 sources" },
  { label: "Receiving now", value: "11", note: "sent logs in the last 15 min" },
  { label: "Quiet", value: "3", note: "nothing for 15 min or more" },
  { label: "Open problems", value: "2", note: "checkout-service, payment-service", hot: true },
  {
    label: "Revenue at risk",
    value: "$4,200 /h",
    note: "value of services with a problem",
    hot: true,
  },
]

const DETAIL = [
  ["Business value", "$1,800 per hour"],
  ["Owner", "payments-team"],
  ["Repository", "acme/shop-checkout"],
  ["Last deploy", "42 min ago, v2.14.0"],
  ["Sources", "Kubernetes · prod-cluster"],
]

export function ServicesScreenSection() {
  return (
    <Section
      id="services-screen"
      title="Services screen (preview)"
      note="Sample data for design review. It is not connected to your workspace."
    >
      <div className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-1.5">
            <Eyebrow>Workspace · Acme Shop</Eyebrow>
            <h3 className="font-heading text-[1.75rem] leading-[2.125rem] font-semibold tracking-tight">
              Services
            </h3>
            <p className="text-sm text-muted-foreground">
              Everything that sends logs, and what it costs you when it breaks.
            </p>
          </div>
          <Button variant="outline" size="sm">
            Export CSV
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {KPIS.map((kpi) => (
            <div key={kpi.label} className="grid gap-1 border border-line bg-sunken p-4">
              <Eyebrow>{kpi.label}</Eyebrow>
              <span
                className={`font-heading text-2xl font-semibold ${kpi.hot ? "text-danger" : ""}`}
              >
                {kpi.value}
              </span>
              <span className="text-[0.75rem] text-muted-foreground">{kpi.note}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search services" placeholder="Search services" className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Status</Eyebrow>
            <Chip selected>All</Chip>
            <Chip>Receiving</Chip>
            <Chip>Quiet</Chip>
            <Chip>Has a problem</Chip>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Environment</Eyebrow>
            <Chip selected>All</Chip>
            <Chip>production</Chip>
            <Chip>staging</Chip>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Logs, 24h</TableHead>
              <TableHead>Errors</TableHead>
              <TableHead>Problem</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Last log</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SERVICES.map((service) => (
              <TableRow key={service.name}>
                <TableCell>
                  <span className="grid gap-0.5">
                    <span className="font-medium">{service.name}</span>
                    <span className="font-mono text-[0.6875rem] text-muted-foreground">
                      {service.environment} · {service.source}
                    </span>
                  </span>
                </TableCell>
                <TableCell>
                  <Status state={service.state}>{service.stateLabel}</Status>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-3">
                    <MiniBars values={service.bars} tone={service.errorsHot ? "danger" : "brand"} />
                    <span className="font-mono text-[0.8125rem]">{service.logs}</span>
                  </span>
                </TableCell>
                <TableCell
                  className={`font-mono ${service.errorsHot ? "text-danger" : "text-muted-foreground"}`}
                >
                  {service.errors}
                </TableCell>
                <TableCell>
                  {service.problem ? (
                    <Badge variant="destructive">{service.problem}</Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">{service.value}</TableCell>
                <TableCell className="text-muted-foreground">{service.last}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="grid gap-4 border border-line bg-sunken p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <Eyebrow>Opens when you click a row</Eyebrow>
              <h4 className="font-heading text-lg font-semibold">checkout-service</h4>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Open live tail <ArrowUpRight />
              </Button>
              <Button size="sm">View problem</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip selected>Overview</Chip>
            <Chip>Logs</Chip>
            <Chip>Problems</Chip>
            <Chip>Fixes</Chip>
            <Chip>Settings</Chip>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DETAIL.map(([label, value]) => (
              <div key={label} className="grid gap-1">
                <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                <dd className="text-sm">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Section>
  )
}
