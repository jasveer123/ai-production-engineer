import type { IncidentStatus } from '@ape/api-contracts';
import { Badge } from '@/components/ui/badge';
import { STATUS_META } from '../live';

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const meta = STATUS_META[status];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
