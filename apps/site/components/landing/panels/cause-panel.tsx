const causes = [
  {
    title: 'Pool exhausted after #1842 removed a query timeout',
    score: 87,
    cites: ['14 log lines', '9 spans', 'commit a41f2c'],
  },
  {
    title: 'Payment gateway latency',
    score: 9,
    cites: ['gateway p95 metric'],
  },
  {
    title: 'Memory pressure on checkout pods',
    score: 4,
    cites: ['ruled out'],
  },
];

export function CausePanel() {
  return (
    <div className="px-panel">
      <div className="px-panel-head">
        <span className="px-ai-chip">Pramaan AI</span>
        <span>3 hypotheses, ranked</span>
      </div>
      <ol className="px-causes">
        {causes.map((c, i) => (
          <li key={c.title} className={i === 0 ? 'px-cause-top' : undefined}>
            <div className="px-cause-row">
              <span>{c.title}</span>
              <b>{c.score}%</b>
            </div>
            <div className="px-meter" aria-hidden="true">
              <i style={{ width: `${c.score}%` }} />
            </div>
            <div className="px-cites">
              {c.cites.map((cite) => (
                <span key={cite}>{cite}</span>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
