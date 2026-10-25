'use client';

import { usePathname } from 'next/navigation';
import { TabNav } from '@/components/ui/tab-nav';

/** Client only to read the current path; the tabs themselves are plain links. */
export function AlertsTabs() {
  const pathname = usePathname();
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  const items = [
    { href: '/alerts/', label: 'Alerts' },
    { href: '/alerts/sources/', label: 'Sources & heartbeats' },
    { href: '/alerts/routes/', label: 'Routes' },
  ];
  return <TabNav label="Alerts sections" items={items} current={path} />;
}
