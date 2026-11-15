const events = [
  { t: '02:14', text: 'Monitor failed in 3 regions', tone: 'bad' },
  { t: '02:14', text: 'Asha paged via escalation policy', tone: 'warn' },
  { t: '02:15', text: 'Acknowledged', tone: 'muted' },
  { t: '02:21', text: 'Root cause posted by Pramaan AI', tone: 'ai' },
  { t: '02:38', text: 'Resolved and verified', tone: 'good' },
];

export function TimelineMini() {
  return (
    <ol className="px-mini px-timeline" aria-hidden="true">
      {events.map((e) => (
        <li key={e.text} className={`px-tone-${e.tone}`}>
          <time>{e.t}</time>
          <span>{e.text}</span>
        </li>
      ))}
    </ol>
  );
}
