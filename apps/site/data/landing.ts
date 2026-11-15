export const stages = [
  { id: 'alert', label: 'Alert fires', short: 'Alert' },
  { id: 'investigate', label: 'AI investigates', short: 'Investigate' },
  { id: 'cause', label: 'Root cause ranked', short: 'Root cause' },
  { id: 'fix', label: 'Fix drafted in sandbox', short: 'Fix' },
  { id: 'approve', label: 'Human approves', short: 'Approve' },
  { id: 'proof', label: 'Proof it is fixed', short: 'Proof' },
] as const;

export type StageId = (typeof stages)[number]['id'];

export const loopSteps = [
  {
    stage: 'alert',
    number: '01',
    time: '02:14',
    title: 'Detect',
    heading: 'A monitor fails. One incident opens.',
    body: 'Checks from three regions confirm checkout is timing out. Pramaan opens a single incident, pages the right on-call engineer and starts investigating before anyone has opened a laptop.',
    points: [
      'Failures confirmed before paging',
      'Escalation policy picks the owner',
      'Investigation starts automatically',
    ],
  },
  {
    stage: 'investigate',
    number: '02',
    time: '02:15',
    title: 'Investigate',
    heading: 'It reads everything you would, in minutes.',
    body: 'The moment an alert fires, Pramaan pulls the logs, traces, metrics, errors, recent deploys and code that touch the failing service, then follows the trail across services.',
    points: [
      'Logs, traces, metrics and errors in one pass',
      'Deploy and commit history in context',
      'Every query it runs is recorded',
    ],
  },
  {
    stage: 'cause',
    number: '03',
    time: '02:21',
    title: 'Explain',
    heading: 'Root causes, ranked, with the receipts.',
    body: 'Hypotheses come back ranked by confidence. Each one cites the exact log lines, spans and commits behind it, so you can check the reasoning instead of trusting it.',
    points: [
      'Confidence for every hypothesis',
      'Citations you can click through',
      'Ruled-out causes shown, not hidden',
    ],
  },
  {
    stage: 'fix',
    number: '04',
    time: '02:29',
    title: 'Draft',
    heading: 'A fix, tested in a sandbox first.',
    body: 'Pramaan drafts a candidate change, reproduces the failure in an isolated sandbox and runs your tests against the patch before anyone is asked to look at it.',
    points: [
      'Reproduction before the patch',
      'Your test suite, run in isolation',
      'A diff small enough to review',
    ],
  },
  {
    stage: 'approve',
    number: '05',
    time: '02:33',
    title: 'Approve',
    heading: 'Nothing ships until a human says so.',
    body: 'The fix arrives as a pull request with the evidence attached. Your engineer reviews it, asks questions and approves. Production writes always wait for that decision.',
    points: [
      'Pull request with evidence attached',
      'Approval policies you control',
      'Full audit trail of who decided what',
    ],
  },
  {
    stage: 'proof',
    number: '06',
    time: '03:08',
    title: 'Prove',
    heading: 'Closed only when production agrees.',
    body: 'After the deploy, Pramaan keeps watching the same signals that raised the alert. The incident closes with a before and after record, not a hopeful note in a channel.',
    points: [
      'Same signals, checked after deploy',
      'Regression watch on the fix',
      'A proof record on every incident',
    ],
  },
] as const;

export const comparison = [
  {
    stage: 'Detect',
    today: 'Alerts fire in one tool while logs, traces and errors live in three others.',
    pramaan: 'Monitors, telemetry, errors and real-user data feed one incident.',
  },
  {
    stage: 'Investigate',
    today: 'An engineer greps logs at 2 a.m. and asks the channel who deployed.',
    pramaan: 'The AI reads every signal and ranks causes, each with cited evidence.',
  },
  {
    stage: 'Fix',
    today: 'A patch is written under pressure and pushed with fingers crossed.',
    pramaan: 'A fix is drafted, reproduced and tested in a sandbox, then approved by a person.',
  },
  {
    stage: 'Verify',
    today: 'The incident closes on a thumbs-up once the graphs look calmer.',
    pramaan: 'Production is checked against the original signal. It closes with proof.',
  },
];

export const guardrails = [
  {
    title: 'Human in the loop',
    body: 'Pull requests, rollbacks and other production writes require an explicit approval from someone on your team.',
  },
  {
    title: 'Sandboxed by default',
    body: 'Reproductions and test runs happen in isolated environments, never against your live systems.',
  },
  {
    title: 'Evidence, not vibes',
    body: 'Every claim links to the log line, span, metric or commit it came from. No citation, no claim.',
  },
  {
    title: 'Audit everything',
    body: 'Queries, hypotheses, approvals and deploys land on the incident timeline for review and postmortems.',
  },
];

export const faqs = [
  {
    q: 'What exactly does Pramaan do?',
    a: 'Pramaan is an observability and incident platform with an AI production engineer built in. It monitors your services, opens incidents and pages the right person, then investigates: it ranks likely root causes with cited evidence, drafts a fix, tests it in a sandbox, waits for a human to approve the pull request and checks in production that the fix worked.',
  },
  {
    q: 'Can the AI change production on its own?',
    a: 'No. Consequential writes such as merging a pull request or running a rollback always wait for explicit approval from your team. The AI does the legwork; people make the call.',
  },
  {
    q: 'Do I have to replace my current tools?',
    a: 'No. Send data with OpenTelemetry, our SDKs, Docker, Kubernetes or plain HTTP. Errors use a Sentry-compatible intake. Start with one service and grow from there.',
  },
  {
    q: 'How does Pramaan prove a fix worked?',
    a: 'After a fix is deployed, Pramaan watches the same signals that raised the alert, such as error rate, latency or a failing check, and records the before and after on the incident. If the signal regresses, the incident says so.',
  },
  {
    q: 'Which AI models does it use?',
    a: 'Pramaan works with the AI provider you configure for your deployment, so you choose where model calls go and under which data terms.',
  },
  {
    q: 'Is Pramaan available today?',
    a: 'Pramaan is in early access and under active development. Request access to try it with your own services; the examples on this site use illustrative data.',
  },
];

export const platformProducts = [
  {
    id: 'uptime',
    name: 'Uptime and heartbeats',
    tagline: 'Know first, from the outside.',
    path: 'Monitors / api.example.com',
    href: '/product/monitoring/',
    kpis: [
      ['Availability', '99.98%'],
      ['Avg response', '182 ms'],
      ['Checks today', '8,640'],
    ],
    features: [
      'HTTP, keyword, TCP and heartbeat checks',
      'Failures confirmed before anyone is paged',
      'Response history for every check',
    ],
  },
  {
    id: 'incidents',
    name: 'Incidents',
    tagline: 'One shared record per incident.',
    path: 'Incidents / INC-482',
    href: '/product/incident-response/',
    kpis: [
      ['Open', '1'],
      ['Time to acknowledge', '40 s'],
      ['Time to resolve', '24 min'],
    ],
    features: [
      'Severity, owner and status in one place',
      'Every alert, page and AI finding on the timeline',
      'Postmortem drafted from the record',
    ],
  },
  {
    id: 'oncall',
    name: 'On-call and escalation',
    tagline: 'The right person, every time.',
    path: 'On-call / Payments rotation',
    href: '/product/incident-response/',
    kpis: [
      ['On call now', 'Asha'],
      ['Next handoff', 'Mon 09:00'],
      ['Escalation steps', '3'],
    ],
    features: [
      'Rotations, overrides and holidays',
      'Multi-step escalation policies',
      'Paging by app, email and SMS',
    ],
  },
  {
    id: 'telemetry',
    name: 'Logs, traces and metrics',
    tagline: 'Every signal, searchable.',
    path: 'Explore / checkout-api',
    href: '/product/telemetry/',
    kpis: [
      ['Events / min', '42.1k'],
      ['Error logs', '1.2%'],
      ['Slowest span', 'db.query'],
    ],
    features: [
      'Structured log search and live tail',
      'Traces across every service a request touched',
      'OpenTelemetry native ingestion',
    ],
  },
  {
    id: 'errors',
    name: 'Error tracking',
    tagline: 'Exceptions with context.',
    path: 'Errors / TypeError',
    href: '/product/errors/',
    kpis: [
      ['Events', '1,284'],
      ['Users affected', '312'],
      ['First seen', 'release 4.12.0'],
    ],
    features: [
      'Grouped exceptions with stack traces',
      'Releases, source maps and regressions',
      'Sentry-compatible intake',
    ],
  },
  {
    id: 'rum',
    name: 'Real user monitoring',
    tagline: 'See what users actually saw.',
    path: 'RUM / Session 2:41',
    href: '/product/real-user-monitoring/',
    kpis: [
      ['Sessions today', '18,420'],
      ['Rage clicks', '37'],
      ['LCP p75', '2.1 s'],
    ],
    features: [
      'Sessions, funnels and frontend errors',
      'Session replay with privacy masking',
      'Web vitals by page and device',
    ],
  },
  {
    id: 'status',
    name: 'Status pages',
    tagline: 'Keep customers in the loop.',
    path: 'Status / status.example.com',
    href: '/product/status-pages/',
    kpis: [
      ['Components', '4'],
      ['Subscribers', '2,406'],
      ['Uptime 90 d', '99.97%'],
    ],
    features: [
      'Public pages tied to your monitors',
      'Subscribers and scheduled maintenance',
      'Custom domains',
    ],
  },
] as const;
