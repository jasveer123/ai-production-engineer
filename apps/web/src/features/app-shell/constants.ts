import {
  Blocks,
  Layers,
  ChartLine,
  Radio,
  LayoutDashboard,
  Users,
  BellRing,
  HeartPulse,
  Globe,
  Megaphone,
  GitPullRequest,
  Settings,
  Siren,
  type LucideIcon,
} from "lucide-react"
import { ROUTES } from "@/lib/constants/routes"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export interface PlaceholderItem {
  label: string
  icon: LucideIcon
}

export const PLACEHOLDER_ITEMS: PlaceholderItem[] = [
  { label: "Metrics", icon: ChartLine },
  { label: "Team", icon: Users },
  { label: "Settings", icon: Settings },
]

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
  { label: "Incidents", href: ROUTES.incidents, icon: Siren },
  { label: "Fixes", href: ROUTES.fixes, icon: GitPullRequest },
  { label: "Monitors", href: ROUTES.monitors, icon: Globe },
  { label: "Alerts", href: ROUTES.alerts, icon: BellRing },
  { label: "Heartbeats", href: ROUTES.heartbeats, icon: HeartPulse },
  { label: "Notifications", href: ROUTES.notifications, icon: Megaphone },
  { label: "Live tail", href: ROUTES.liveTail, icon: Radio },
  { label: "Services", href: ROUTES.services, icon: Layers },
  { label: "Integrations", href: ROUTES.integrations, icon: Blocks },
]
