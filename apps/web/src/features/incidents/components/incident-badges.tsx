import { Badge, type BadgeTone } from '@/components/ui/badge';
import { STATUS_LABEL } from '../incidents';
import type { IncidentStatus, Severity } from '../types';

const SEVERITY_TONE: Record<Severity, BadgeTone> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warn',
  low: 'neutral',
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} icon={severity === 'low' ? 'info' : 'alert'}>
      {severity}
    </Badge>
  );
}

const STATUS_TONE: Record<IncidentStatus, BadgeTone> = {
  investigating: 'info',
  awaiting_approval: 'warn',
  fix_ready: 'ai',
  pr_open: 'brand',
  verifying: 'info',
  resolved: 'ok',
  needs_attention: 'danger',
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
