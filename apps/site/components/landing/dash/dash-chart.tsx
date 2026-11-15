import type { CSSProperties } from 'react';
import { chartRecovery, chartSpike, markers, reveal } from '@/data/dashboard';

interface DashChartProps {
  phase: number;
}

export function DashChart({ phase }: DashChartProps) {
  return (
    <div className="px-chart-card">
      <div className="px-card-head">
        <span>Error rate · checkout-api</span>
        <span className="px-legend">
          <i className="px-legend-bad" /> Errors
          <i className="px-legend-good" /> Recovered
        </span>
      </div>
      <div className="px-chart">
        <div className="px-chart-grid">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div
          className="px-chart-reveal"
          style={{ '--reveal': `${reveal[phase]}%` } as CSSProperties}
        >
          <div className="px-chart-edge px-edge-bad">
            <div
              className="px-chart-area px-area-bad"
              style={{ clipPath: `polygon(${chartSpike})` }}
            />
          </div>
          <div className="px-chart-edge px-edge-good">
            <div
              className="px-chart-area px-area-good"
              style={{ clipPath: `polygon(${chartRecovery})` }}
            />
          </div>
        </div>
        <div className={phase >= 4 ? 'px-fix-line is-on' : 'px-fix-line'} style={{ left: '66%' }}>
          <span>Fix deployed</span>
        </div>
        {markers.map((m) => (
          <span
            key={m.n}
            className={phase >= m.phase ? 'px-marker is-on' : 'px-marker'}
            style={{ left: `${m.x}%`, top: `${m.y}%` }}
            title={m.label}
          >
            {m.n}
          </span>
        ))}
      </div>
      <div className="px-chart-axis">
        <span>02:00</span>
        <span>02:15</span>
        <span>02:30</span>
        <span>02:45</span>
        <span>03:00</span>
      </div>
    </div>
  );
}
