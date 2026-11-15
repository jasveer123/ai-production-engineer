const regions = [
  { name: 'eu-west', bars: [12, 14, 13, 15, 22, 48, 72, 86, 90, 88] },
  { name: 'us-east', bars: [10, 11, 12, 11, 18, 40, 66, 80, 84, 82] },
  { name: 'ap-south', bars: [14, 13, 15, 14, 26, 52, 70, 78, 92, 95] },
];

export function RegionsChart() {
  return (
    <div className="px-sx">
      <div className="px-sx-head">
        <span>p95 latency by region</span>
        <span className="px-bad">3 of 3 failing</span>
      </div>
      {regions.map((r) => (
        <div key={r.name} className="px-sx-region">
          <span>{r.name}</span>
          <div className="px-sx-bars">
            {r.bars.map((h, i) => (
              <i
                key={i}
                className={h > 40 ? 'is-hot' : undefined}
                style={{ height: `${h}%`, animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
          <b className="px-bad">{(r.bars[9] / 20).toFixed(1)} s</b>
        </div>
      ))}
    </div>
  );
}
