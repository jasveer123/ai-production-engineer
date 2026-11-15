const suites = [
  { name: 'Unit', done: 96, total: 96 },
  { name: 'Integration', done: 28, total: 28 },
  { name: 'Load (500 rps)', done: 4, total: 4 },
];

export function LoadTest() {
  return (
    <div className="px-sx">
      <div className="px-sx-head">
        <span>Sandbox run · p95 under load</span>
        <span className="px-good">passed</span>
      </div>
      <div className="px-sx-compare">
        <div>
          <span>Before fix</span>
          <i className="is-bad" style={{ width: '92%' }} />
          <b className="px-bad">4.6 s</b>
        </div>
        <div>
          <span>With fix</span>
          <i className="is-good" style={{ width: '8%' }} />
          <b className="px-good">210 ms</b>
        </div>
      </div>
      <div className="px-sx-suites">
        {suites.map((s) => (
          <div key={s.name}>
            <span>{s.name}</span>
            <div>
              <i style={{ width: `${(s.done / s.total) * 100}%` }} />
            </div>
            <b>
              {s.done}/{s.total}
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}
