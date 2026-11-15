const lines = [
  { t: '02:13:58', text: 'deploy #1842 rolled out to checkout', hot: false },
  { t: '02:14:07', text: 'pool wait 1.9s (20/20 in use)', hot: true },
  { t: '02:14:07', text: 'query timeout after 30000ms', hot: true },
];

const spans = [
  { name: 'POST /checkout', start: 0, width: 100, slow: false },
  { name: 'cart.load', start: 4, width: 12, slow: false },
  { name: 'pool.acquire', start: 18, width: 30, slow: true },
  { name: 'db.query', start: 48, width: 46, slow: true },
];

export function EvidenceSnippet() {
  return (
    <div className="px-sx">
      <div className="px-sx-head">
        <span>Cited evidence</span>
        <span>commit a41f2c</span>
      </div>
      <div className="px-sx-logs">
        {lines.map((l) => (
          <code key={l.text} className={l.hot ? 'is-hot' : undefined}>
            <span>{l.t}</span>
            {l.text}
          </code>
        ))}
      </div>
      <div className="px-sx-trace">
        {spans.map((s) => (
          <div key={s.name}>
            <span>{s.name}</span>
            <div>
              <i
                className={s.slow ? 'is-slow' : undefined}
                style={{ marginLeft: `${s.start}%`, width: `${s.width}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
