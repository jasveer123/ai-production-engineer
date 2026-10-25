import { IncidentReport } from '@/features/incidents/components/incident-report';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <IncidentReport id={(await params).id} />;
}
