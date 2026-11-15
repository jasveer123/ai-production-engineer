import type { StageId } from '@/data/landing';
import { AlertPanel } from './alert-panel';
import { InvestigatePanel } from './investigate-panel';
import { CausePanel } from './cause-panel';
import { FixPanel } from './fix-panel';
import { ApprovePanel } from './approve-panel';
import { ProofPanel } from './proof-panel';

const panels = {
  alert: AlertPanel,
  investigate: InvestigatePanel,
  cause: CausePanel,
  fix: FixPanel,
  approve: ApprovePanel,
  proof: ProofPanel,
};

interface StagePanelProps {
  stage: StageId;
}

export function StagePanel({ stage }: StagePanelProps) {
  const Panel = panels[stage];
  return <Panel />;
}
