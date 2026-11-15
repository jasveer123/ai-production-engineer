import { logLines } from '@/data/dashboard';

interface DashLogsProps {
  recovered: boolean;
}

export function DashLogs({ recovered }: DashLogsProps) {
  const lines = recovered
    ? logLines.map((l) => ({
        ...l,
        level: 'info',
        text: l.text.replace(/timeout.*|504.*|retry.*|wait.*/, '200 OK'),
      }))
    : logLines;
  return (
    <div className="px-logs-card">
      <div className="px-card-head">
        <span>Live tail</span>
        <span className="px-live-dot">streaming</span>
      </div>
      <div className="px-tail">
        <div className="px-tail-scroll">
          {[...lines, ...lines].map((l, i) => (
            <code key={i} className={`px-tail-${l.level}`}>
              <span>{l.time}</span>
              <b>{l.level.toUpperCase()}</b>
              <em>{l.service}</em>
              {l.text}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}
