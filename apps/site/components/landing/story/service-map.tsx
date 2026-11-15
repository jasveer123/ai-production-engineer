const nodes = [
  { name: 'web', state: 'ok' },
  { name: 'api', state: 'ok' },
  { name: 'checkout', state: 'bad' },
  { name: 'db-proxy', state: 'bad' },
  { name: 'postgres', state: 'warn' },
];

const counters = [
  ['Log lines read', '1.2M'],
  ['Traces sampled', '342'],
  ['Deploys checked', '6'],
];

export function ServiceMap() {
  return (
    <div className="px-sx">
      <div className="px-sx-head">
        <span>Request path · POST /checkout</span>
        <span className="px-ai-chip">tracing</span>
      </div>
      <div className="px-sx-map">
        {nodes.map((n) => (
          <span key={n.name} className={`px-sx-node is-${n.state}`}>
            <i />
            {n.name}
          </span>
        ))}
      </div>
      <div className="px-sx-counters">
        {counters.map(([label, value]) => (
          <div key={label}>
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
