import { kpis, recoveredBars } from '@/data/dashboard';

interface DashKpisProps {
  phase: number;
}

export function DashKpis({ phase }: DashKpisProps) {
  const recovered = phase >= 5;
  return (
    <div className="px-kpis">
      {kpis.map((k, i) => {
        const bars = recovered && i !== 2 ? recoveredBars : k.bars;
        const tone = i === 2 ? '' : recovered ? 'is-good' : phase >= 4 ? 'is-warn' : 'is-bad';
        return (
          <div key={k.label} className={`px-kpi ${tone}`}>
            <span>{k.label}</span>
            <b key={k.values[phase]}>{k.values[phase]}</b>
            <div className="px-kpi-bars" aria-hidden="true">
              {bars.map((h, j) => (
                <i key={j} style={{ height: `${h * 8}%` }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
