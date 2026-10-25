import { IncidentLogs } from '@/features/incidents/components/incident-logs';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <IncidentLogs id={(await params).id} />;
}
