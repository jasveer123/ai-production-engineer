import { Check, FileCode2 } from 'lucide-react';

const diff = [
  { kind: 'ctx', text: 'export const pool = createPool({' },
  { kind: 'del', text: '  max: 20,' },
  { kind: 'add', text: '  max: 20, acquireTimeoutMs: 2000,' },
  { kind: 'ctx', text: '});' },
  { kind: 'del', text: 'const rows = await db.query(sql);' },
  { kind: 'add', text: 'const rows = await db.query(sql, { timeout: 1500 });' },
];

const checks = ['Failure reproduced', '128 of 128 tests pass', 'Load test p95 210 ms'];

export function FixPanel() {
  return (
    <div className="px-panel">
      <div className="px-panel-head">
        <FileCode2 size={14} />
        <span>services/checkout/db.ts</span>
        <span className="px-diffstat">
          <b className="px-good">+2</b> <b className="px-bad">-2</b>
        </span>
      </div>
      <pre className="px-diff" aria-label="Proposed code change">
        {diff.map((line, i) => (
          <code key={i} className={`px-diff-${line.kind}`}>
            {line.kind === 'add' ? '+ ' : line.kind === 'del' ? '- ' : '  '}
            {line.text}
          </code>
        ))}
      </pre>
      <div className="px-sandbox">
        <span>Sandbox</span>
        {checks.map((c, i) => (
          <b key={c} style={{ animationDelay: `${400 + i * 300}ms` }}>
            <Check size={13} /> {c}
          </b>
        ))}
      </div>
    </div>
  );
}
