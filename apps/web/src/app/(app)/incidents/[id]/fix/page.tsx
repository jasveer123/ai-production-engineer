import { IncidentFix } from '@/features/incidents/components/incident-fix';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <IncidentFix id={(await params).id} />;
}
