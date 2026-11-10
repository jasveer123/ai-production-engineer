import {
  Blocks,
  ChartLine,
  Radio,
  LayoutDashboard,
  Database,
  Users,
  BellRing,
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
  { label: "Incidents", icon: Siren },
  { label: "Fixes", icon: GitPullRequest },
  { label: "Metrics", icon: ChartLine },
  { label: "Alerts", icon: BellRing },
  { label: "Sources", icon: Database },
  { label: "Team", icon: Users },
  { label: "Settings", icon: Settings },
]

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: ROUTES.dashboard, icon: LayoutDashboard },
  { label: "Live tail", href: ROUTES.liveTail, icon: Radio },
  { label: "Integrations", href: ROUTES.integrations, icon: Blocks },
]
