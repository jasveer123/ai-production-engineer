import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IncidentHeader } from '@/features/incidents/components/incident-header';
import { IncidentTabs } from './incident-tabs';

export const metadata: Metadata = { title: 'Incident' };

export default async function IncidentLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <>
      <IncidentHeader id={id} />
      <IncidentTabs id={id} />
      {children}
    </>
  );
}
