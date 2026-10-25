import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { AlertsTabs } from '@/features/alerts/components/alerts-tabs';

export const metadata: Metadata = { title: 'Alerts' };

export default function AlertsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader
        title="Alerts"
        description="Alerts from Prometheus, Grafana, Sentry, heartbeats and other tools. Routes decide which ones open an incident."
      />
      <AlertsTabs />
      {children}
    </>
  );
}
