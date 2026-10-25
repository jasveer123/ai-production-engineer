'use client';

import { usePathname } from 'next/navigation';
import { TabNav } from '@/components/ui/tab-nav';

/** Client only to read the current path; the tabs themselves are plain links. */
export function IncidentTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/incidents/${id}/`;
  const items = [
    { href: base, label: 'Report' },
    { href: `${base}timeline/`, label: 'Timeline' },
    { href: `${base}logs/`, label: 'Logs' },
    { href: `${base}fix/`, label: 'Fix' },
    { href: `${base}recovery/`, label: 'Recovery' },
  ];
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return <TabNav label="Incident sections" items={items} current={path} />;
}
