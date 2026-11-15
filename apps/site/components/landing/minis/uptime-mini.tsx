const checks = Array.from({ length: 30 }, (_, i) =>
  i === 21 || i === 22 ? 'down' : i === 20 ? 'slow' : 'up',
);

export function UptimeMini() {
  return (
    <div className="px-mini px-uptime" aria-hidden="true">
      <div className="px-mini-row">
        <span>api.example.com</span>
        <b className="px-good">99.98%</b>
      </div>
      <div className="px-uptime-bars">
        {checks.map((c, i) => (
          <i key={i} className={`px-up-${c}`} style={{ animationDelay: `${i * 30}ms` }} />
        ))}
      </div>
      <div className="px-mini-row px-mini-sub">
        <span>HTTP check</span>
        <span>every 30 s</span>
      </div>
    </div>
  );
}
