import { BadgeCheck, BellRing, GitPullRequest, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { aiFeed } from '@/data/dashboard';
import { LottiePlayer } from '../../ui/lottie-player';

const icons = {
  alert: BellRing,
  step: Search,
  cause: Sparkles,
  fix: GitPullRequest,
  approve: ShieldCheck,
  proof: BadgeCheck,
};

interface DashAiFeedProps {
  phase: number;
}

export function DashAiFeed({ phase }: DashAiFeedProps) {
  return (
    <section className="px-ai-panel" aria-label="AI engineer activity">
      <div className="px-ai-head">
        <LottiePlayer src="/lottie/ai-scan.json" label="AI working" className="px-ai-lottie" />
        <div>
          <b>Pramaan AI</b>
          <span>{phase >= 5 ? 'Incident closed with proof' : 'Working on INC-482'}</span>
        </div>
      </div>
      <ol className="px-feed">
        {aiFeed
          .filter((f) => f.phase <= phase)
          .map((f) => {
            const Icon = icons[f.kind as keyof typeof icons];
            return (
              <li key={f.title} className={`px-feed-item px-feed-${f.kind}`}>
                <span className="px-feed-icon">
                  <Icon size={13} />
                </span>
                <div>
                  <b>{f.title}</b>
                  <span>{f.detail}</span>
                  {'score' in f && f.score && (
                    <div className="px-feed-score">
                      <div>
                        <i style={{ width: `${f.score}%` }} />
                      </div>
                      <em>{f.score}%</em>
                    </div>
                  )}
                  {f.kind === 'fix' && phase === 3 && (
                    <div className="px-feed-actions">
                      <span className="px-approve-btn">Approve and merge</span>
                      <span className="px-ghost-btn">Review diff</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        {phase < 5 && (
          <li className="px-feed-thinking">
            <span />
            <span />
            <span />
          </li>
        )}
      </ol>
    </section>
  );
}
