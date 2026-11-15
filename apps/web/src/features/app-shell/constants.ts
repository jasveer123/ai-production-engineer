import {
  Activity,
  BellRing,
  Blocks,
  Bug,
  Globe,
  GitPullRequest,
  HeartPulse,
  Layers,
  LayoutDashboard,
  Megaphone,
  MousePointerClick,
  PhoneCall,
  Radio,
  ScrollText,
  ListTree,
  ChartLine,
  ChartColumn,
  Settings,
  Siren,
  Sparkles,
  Workflow,
  type LucideIcon,
} from "lucide-react"
import { ROUTES } from "@/lib/constants/routes"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
      { label: "Ask AI", href: ROUTES.assistant, icon: Sparkles },
    ],
  },
  {
    label: "Respond",
    items: [
      { label: "Incidents", href: ROUTES.incidents, icon: Siren },
      { label: "Fixes", href: ROUTES.fixes, icon: GitPullRequest },
      { label: "On-call", href: ROUTES.oncall, icon: PhoneCall },
      { label: "Escalation", href: ROUTES.escalation, icon: Workflow },
      { label: "Reporting", href: ROUTES.reporting, icon: ChartColumn },
      { label: "Alerts", href: ROUTES.alerts, icon: BellRing },
    ],
  },
  {
    label: "Uptime",
    items: [
      { label: "Monitors", href: ROUTES.monitors, icon: Globe },
      { label: "Heartbeats", href: ROUTES.heartbeats, icon: HeartPulse },
      { label: "Status pages", href: ROUTES.statusPages, icon: Activity },
      { label: "Services", href: ROUTES.services, icon: Layers },
    ],
  },
  {
    label: "Observe",
    items: [
      { label: "Logs", href: ROUTES.exploreLogs, icon: ScrollText },
      { label: "Traces", href: ROUTES.exploreTraces, icon: ListTree },
      { label: "Live tail", href: ROUTES.liveTail, icon: Radio },
      { label: "Metrics", href: ROUTES.metrics, icon: ChartLine },
      { label: "Errors", href: ROUTES.errors, icon: Bug },
      { label: "Real users", href: ROUTES.rum, icon: MousePointerClick },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "Integrations", href: ROUTES.integrations, icon: Blocks },
      { label: "Notifications", href: ROUTES.notifications, icon: Megaphone },
      { label: "Settings", href: ROUTES.settings, icon: Settings },
    ],
  },
]
