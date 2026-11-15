import { Check, Clock3 } from 'lucide-react';

const checks = [
  { name: 'CI · build and unit tests', done: true },
  { name: 'Sandbox reproduction', done: true },
  { name: 'Policy · one human approval', done: false },
];

const audit = [
  '02:29 Pramaan AI opened PR #2291',
  '02:31 Asha requested the rollback plan',
  '02:33 Asha approved and merged',
];

export function ChecksList() {
  return (
    <div className="px-sx">
      <div className="px-sx-head">
        <span>Checks</span>
        <span>2 of 3 passed</span>
      </div>
      <ul className="px-sx-checks">
        {checks.map((c) => (
          <li key={c.name} className={c.done ? 'is-done' : 'is-wait'}>
            {c.done ? <Check size={13} /> : <Clock3 size={13} />}
            {c.name}
          </li>
        ))}
      </ul>
      <div className="px-sx-audit">
        {audit.map((a) => (
          <code key={a}>{a}</code>
        ))}
      </div>
    </div>
  );
}
