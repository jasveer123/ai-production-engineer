import { IncidentRecovery } from '@/features/incidents/components/incident-recovery';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <IncidentRecovery id={(await params).id} />;
}
