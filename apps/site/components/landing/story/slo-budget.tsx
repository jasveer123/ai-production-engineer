const watch = Array.from({ length: 12 }, (_, i) => i);

export function SloBudget() {
  return (
    <div className="px-sx">
      <div className="px-sx-head">
        <span>Checkout availability SLO · 99.9%</span>
        <span className="px-good">recovering</span>
      </div>
      <div className="px-sx-budget">
        <div>
          <i style={{ width: '64%' }} />
        </div>
        <span>
          Error budget left <b>64%</b>
        </span>
      </div>
      <div className="px-sx-watch">
        <span>Regression watch · 30 min</span>
        <div>
          {watch.map((i) => (
            <i key={i} style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
