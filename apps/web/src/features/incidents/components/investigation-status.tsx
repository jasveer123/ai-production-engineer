import type { InvestigationView } from '@ape/api-contracts';
import { Banner } from '@/components/ui/banner';

export const RUNNING = ['collecting_evidence', 'analyzing'];

export function InvestigationStatus({ investigation }: { investigation: InvestigationView }) {
  const i = investigation;
  if (RUNNING.includes(i.status))
    return (
      <Banner tone="info" title="The AI is investigating.">
        {i.status === 'collecting_evidence' ? 'Collecting evidence.' : 'Analyzing the evidence.'}{' '}
        This page refreshes on its own.
      </Banner>
    );
  if (i.status === 'failed' || i.status === 'cancelled')
    return (
      <Banner
        tone="danger"
        title={`The investigation ${i.status === 'failed' ? 'failed' : 'was cancelled'}.`}
      >
        {i.statusReason ?? 'Start it again when ready.'}
      </Banner>
    );
  if (i.status === 'needs_review')
    return (
      <Banner tone="info" title="The AI is not sure. Review before acting.">
        {i.statusReason ?? 'The evidence was not strong enough for a confident answer.'}
      </Banner>
    );
  return (
    <Banner tone="ai" title="Written by the AI from the evidence below.">
      Every claim cites evidence; claims without it are removed automatically.
    </Banner>
  );
}
