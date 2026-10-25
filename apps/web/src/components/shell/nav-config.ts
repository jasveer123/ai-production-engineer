import type { IconName } from '@/components/ui/icon';

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  badge?: { text: string; tone: 'danger' | 'new' | 'live' };
};

export const MAIN_NAV: NavItem[] = [
  { href: '/', label: 'Overview', icon: 'home' },
  { href: '/changes/', label: 'Changes', icon: 'git' },
  { href: '/deploys/', label: 'Deploys', icon: 'send' },
  { href: '/incidents/', label: 'Incidents', icon: 'flame' },
  { href: '/business/', label: 'Business impact', icon: 'chart' },
  { href: '/alerts/', label: 'Alerts', icon: 'bell' },
  { href: '/logs/', label: 'Logs', icon: 'list' },
  { href: '/services/', label: 'Services', icon: 'box' },
  { href: '/fixes/', label: 'Fixes', icon: 'code' },
  { href: '/quality/', label: 'Quality', icon: 'check' },
];

export const WORKSPACE_NAV: NavItem[] = [
  { href: '/integrations/', label: 'Integrations', icon: 'plug' },
  { href: '/members/', label: 'Members', icon: 'users' },
  { href: '/audit/', label: 'Audit log', icon: 'shield' },
  { href: '/settings/', label: 'Settings', icon: 'gear' },
  { href: '/settings/usage/', label: 'Usage', icon: 'chart' },
];

/** True when `pathname` is this nav item's page or one of its sub-pages. */
export function isActive(href: string, pathname: string): boolean {
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return href === '/' ? path === '/' : path.startsWith(href);
}

/** Pages that read real workspace data. Every other page still shows sample data. */
export const LIVE_ROUTES = [
  '/integrations/',
  '/members/',
  '/logs/',
  '/account/',
  '/audit/',
  '/services/',
  '/incidents/',
  '/',
  '/settings/',
  '/alerts/',
  '/fixes/',
  '/quality/',
  '/deploys/',
  '/changes/',
  '/business/',
  '/settings/usage/',
];

export function isLiveRoute(pathname: string): boolean {
  return LIVE_ROUTES.some((r) => isActive(r, pathname));
}
