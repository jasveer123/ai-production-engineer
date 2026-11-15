import { BadgeCheck } from 'lucide-react';

const series = [62, 70, 66, 74, 71, 78, 69, 22, 9, 5, 4, 3, 4, 3, 2, 3, 2, 2];
const deployAt = 7;

export function ProofPanel() {
  return (
    <div className="px-panel">
      <div className="px-panel-head">
        <BadgeCheck size={14} />
        <span>Verification</span>
        <span className="px-verified">Verified</span>
      </div>
      <div className="px-proof-chart" aria-hidden="true">
        {series.map((h, i) => (
          <i
            key={i}
            className={i < deployAt ? 'px-before' : 'px-after'}
            style={{ height: `${h}%`, animationDelay: `${i * 35}ms` }}
          />
        ))}
        <span className="px-deploy-mark" style={{ left: `${(deployAt / series.length) * 100}%` }}>
          Fix deployed
        </span>
      </div>
      <div className="px-kv">
        <div>
          <span>Error rate</span>
          <b>
            12.4% → <em className="px-good">0.2%</em>
          </b>
        </div>
        <div>
          <span>p95 latency</span>
          <b>
            4.8 s → <em className="px-good">210 ms</em>
          </b>
        </div>
        <div>
          <span>Watched</span>
          <b>30 min</b>
        </div>
      </div>
      <p className="px-panel-foot px-proof-foot">
        <BadgeCheck size={14} /> INC-482 resolved with proof attached.
      </p>
    </div>
  );
}
