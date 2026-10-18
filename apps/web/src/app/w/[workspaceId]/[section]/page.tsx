'use client';

import { notFound, useParams } from 'next/navigation';
import { Card, PageHeader } from '@/components/ui';
import { NAV } from '@/lib/nav';

/** Placeholder for navigation sections that later phases build. */
export default function UpcomingSection() {
  const { section } = useParams<{ section: string }>();
  const item = NAV.find((n) => n.slug === section && n.phase);
  if (!item) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={item.label} />
      <Card className="p-6 text-sm text-subtle">
        This section is built in Phase {item.phase} of the plan.
      </Card>
    </div>
  );
}
