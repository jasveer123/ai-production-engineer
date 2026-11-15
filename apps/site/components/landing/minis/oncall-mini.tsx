const people = [
  { name: 'Asha', span: 3, now: true },
  { name: 'Ravi', span: 2, now: false },
  { name: 'Mei', span: 2, now: false },
];

export function OnCallMini() {
  return (
    <div className="px-mini px-oncall" aria-hidden="true">
      <div className="px-mini-row">
        <span>Payments rotation</span>
        <span className="px-mini-sub">This week</span>
      </div>
      <div className="px-oncall-track">
        {people.map((p) => (
          <span key={p.name} style={{ flexGrow: p.span }} className={p.now ? 'is-now' : undefined}>
            {p.name}
          </span>
        ))}
      </div>
      <div className="px-escalate">
        <span>1 · Primary</span>
        <span>2 · Secondary after 5 min</span>
        <span>3 · Team lead</span>
      </div>
    </div>
  );
}
