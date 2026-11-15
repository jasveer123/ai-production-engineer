import { Check, LoaderCircle } from 'lucide-react';

const lines = [
  'Searched 1.2M log lines across checkout, payments and db-proxy',
  'Traced 342 slow requests to POST /checkout',
  'Found deploy #1842 shipped 11 minutes before the spike',
  'Database connection pool at 100% for 9 minutes',
];

export function InvestigatePanel() {
  return (
    <div className="px-panel">
      <div className="px-panel-head">
        <span className="px-ai-chip">Pramaan AI</span>
        <span>Investigating INC-482</span>
      </div>
      <ul className="px-steps-list">
        {lines.map((line, i) => (
          <li key={line} style={{ animationDelay: `${i * 380}ms` }}>
            <Check size={14} />
            <span>{line}</span>
          </li>
        ))}
        <li className="px-thinking" style={{ animationDelay: '1500ms' }}>
          <LoaderCircle size={14} />
          <span>Ranking likely causes</span>
        </li>
      </ul>
    </div>
  );
}
