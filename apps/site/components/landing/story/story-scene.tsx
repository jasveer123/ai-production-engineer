import type { StageId } from '@/data/landing';
import { StagePanel } from '../panels/stage-panel';
import { RegionsChart } from './regions-chart';
import { ServiceMap } from './service-map';
import { EvidenceSnippet } from './evidence-snippet';
import { LoadTest } from './load-test';
import { ChecksList } from './checks-list';
import { SloBudget } from './slo-budget';

const extras = {
  alert: { Extra: RegionsChart, path: 'Monitors / checkout-api' },
  investigate: { Extra: ServiceMap, path: 'AI engineer / INC-482' },
  cause: { Extra: EvidenceSnippet, path: 'AI engineer / Root cause' },
  fix: { Extra: LoadTest, path: 'Sandbox / run 7f3c' },
  approve: { Extra: ChecksList, path: 'Pull requests / #2291' },
  proof: { Extra: SloBudget, path: 'Verification / INC-482' },
};

interface StorySceneProps {
  stage: StageId;
}

export function StoryScene({ stage }: StorySceneProps) {
  const { Extra, path } = extras[stage];
  return (
    <div className="px-scene">
      <div className="px-scene-bar">
        <span className="px-lights" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="px-scene-path">{path}</span>
      </div>
      <div className="px-scene-body">
        <StagePanel stage={stage} />
        <Extra />
      </div>
    </div>
  );
}
