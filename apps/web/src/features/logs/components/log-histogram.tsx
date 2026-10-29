import type { LogBucket } from '../query';

type LogHistogramProps = { buckets: LogBucket[]; labels: [string, string, string] };

const HEIGHT = 96;

export function LogHistogram({ buckets, labels }: LogHistogramProps) {
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const width = buckets.length * 30;
  const totalErrors = buckets.reduce((sum, b) => sum + b.errors, 0);
  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT + 18}`}
        className="h-[120px] w-full"
        role="img"
        aria-label={`Logs over time, ${totalErrors} errors, peak ${max} lines in one bucket`}
        preserveAspectRatio="none"
      >
        {buckets.map((b, i) => {
          const h = (b.total / max) * HEIGHT;
          const e = (b.errors / max) * HEIGHT;
          return (
            <g key={b.start}>
              <rect
                x={i * 30 + 4}
                y={HEIGHT - h}
                width={22}
                height={h}
                rx={3}
                className="fill-brand-soft"
              />
              <rect
                x={i * 30 + 4}
                y={HEIGHT - e}
                width={22}
                height={e}
                rx={3}
                className="fill-danger"
              />
            </g>
          );
        })}
      </svg>
      <figcaption className="flex justify-between font-mono text-[11px] text-ink-muted">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </figcaption>
    </figure>
  );
}
