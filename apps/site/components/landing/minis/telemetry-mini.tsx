const logs = [
  { level: 'INFO', text: 'POST /checkout 200 182ms' },
  { level: 'WARN', text: 'pool wait 1.9s' },
  { level: 'ERROR', text: 'query timeout after 30s' },
  { level: 'INFO', text: 'GET /cart 200 41ms' },
  { level: 'ERROR', text: 'upstream reset' },
];

const spans = [
  { name: 'POST /checkout', start: 0, width: 100 },
  { name: 'cart.load', start: 4, width: 14 },
  { name: 'db.query', start: 20, width: 72 },
  { name: 'payments.auth', start: 93, width: 6 },
];

export function TelemetryMini() {
  return (
    <div className="px-mini px-telemetry" aria-hidden="true">
      <div className="px-logs">
        <div className="px-logs-scroll">
          {[...logs, ...logs].map((l, i) => (
            <span key={i} className={`px-log-${l.level.toLowerCase()}`}>
              <b>{l.level}</b> {l.text}
            </span>
          ))}
        </div>
      </div>
      <div className="px-trace">
        {spans.map((s) => (
          <div key={s.name} className="px-span-row">
            <span>{s.name}</span>
            <div>
              <i
                style={{ marginLeft: `${s.start}%`, width: `${s.width}%` }}
                className={s.name === 'db.query' ? 'is-slow' : undefined}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
