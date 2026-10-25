import { IncidentTimeline } from '@/features/incidents/components/incident-timeline';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <IncidentTimeline id={(await params).id} />;
}
