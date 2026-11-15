import { BellRing } from 'lucide-react';

const bars = [12, 14, 11, 13, 12, 15, 13, 14, 18, 26, 44, 63, 78, 86, 92, 88, 95, 91];

export function AlertPanel() {
  return (
    <div className="px-panel">
      <div className="px-panel-head">
        <span className="px-sev">SEV-1</span>
        <span>checkout-api</span>
        <span className="px-live">Live</span>
      </div>
      <h4>Checkout requests are timing out</h4>
      <div className="px-kv">
        <div>
          <span>p95 latency</span>
          <b className="px-bad">4.8 s</b>
        </div>
        <div>
          <span>Error rate</span>
          <b className="px-bad">12.4%</b>
        </div>
        <div>
          <span>Started</span>
          <b>02:14</b>
        </div>
      </div>
      <div className="px-spark" aria-hidden="true">
        {bars.map((h, i) => (
          <i
            key={i}
            className={h > 40 ? 'px-spark-hot' : undefined}
            style={{ height: `${h}%`, animationDelay: `${i * 40}ms` }}
          />
        ))}
      </div>
      <p className="px-panel-foot">
        <BellRing size={14} /> Paged the payments on-call. Acknowledged in 40 s.
      </p>
    </div>
  );
}
