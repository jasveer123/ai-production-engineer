export const products = [
  {
    slug: 'monitoring',
    name: 'Uptime monitoring',
    label: 'Know when something changes.',
    description:
      'Check your services from the outside. Review the response, timing, and recent check history before moving into an incident.',
    route: '/monitors',
    guide: 'monitoring',
    features: [
      'HTTP, keyword, expected-status and TCP checks',
      'Configurable check intervals and failure confirmations',
      'Manual checks, pause/resume and response history',
    ],
    workflow: ['Add a target', 'Review check results', 'Investigate a failure'],
    note: 'Monitor routing and notification policies are configured separately. A failed check is not proof someone received a notification.',
  },
  {
    slug: 'incident-response',
    name: 'Incident response',
    label: 'Keep the response in one place.',
    description:
      'Bring alerts, ownership, acknowledgement, and investigation into a shared incident timeline.',
    route: '/incidents',
    guide: 'incident-response',
    features: [
      'Incident lists, severity and event timelines',
      'Acknowledgement and escalation policies',
      'On-call schedules and responder overrides',
    ],
    workflow: ['Open the incident', 'Acknowledge ownership', 'Review context and recovery'],
    note: 'Notification delivery depends on the deployment’s configured providers. Review channel health and escalation configuration before relying on paging.',
  },
  {
    slug: 'telemetry',
    name: 'Logs & traces',
    label: 'Go from the signal to the context.',
    description:
      'Collect structured events, find the logs that matter, and follow a trace through the services involved.',
    route: '/explore/logs',
    guide: 'telemetry',
    features: [
      'Structured log search and live tail',
      'Trace exploration and per-service context',
      'HTTP, SDK, collector and OTLP ingestion',
    ],
    workflow: ['Connect a source', 'Send a test event', 'Explore logs and related traces'],
    note: 'Query results reflect actual ingested data and configured retention. Empty results do not establish that a service is healthy.',
  },
  {
    slug: 'errors',
    name: 'Error tracking',
    label: 'Give recurring failures a history.',
    description:
      'Review grouped errors, their occurrences, release context, and source maps alongside the rest of your operational evidence.',
    route: '/errors',
    guide: 'error-tracking',
    features: [
      'Error groups and occurrence detail',
      'Resolve, ignore and regression workflows',
      'Release context and source-map endpoints',
    ],
    workflow: ['Report an exception', 'Review the error group', 'Track the next occurrence'],
    note: 'Use the current SDK or documented error intake. A custom error endpoint alone does not establish compatibility with every third-party SDK.',
  },
  {
    slug: 'ai-investigation',
    name: 'AI SRE & remediation',
    label: 'Investigate the cause. Propose the next fix.',
    description:
      'Connect incident evidence and repository context to an AI-assisted investigation, a candidate patch, isolated validation, and a human-approved pull request workflow.',
    route: '/assistant',
    guide: 'ai-investigation',
    features: [
      'Workspace chat and incident investigations',
      'Evidence-linked explanations',
      'Isolated validation and human-approved fix workflows',
    ],
    workflow: ['Gather context', 'Inspect the explanation', 'Review a proposed change'],
    note: 'AI providers and workers must be configured. Investigation output is a hypothesis to assess, not a guarantee of root cause or a production-ready fix.',
  },
  {
    slug: 'status-pages',
    name: 'Status pages',
    label: 'Keep your users in the loop.',
    description:
      'Publish service updates and maintenance communication through a page connected to the services you monitor.',
    route: '/status-pages',
    guide: 'status-pages',
    features: [
      'Public service pages and monitor links',
      'Status updates and service history',
      'Subscriber confirmation and custom-domain configuration',
    ],
    workflow: ['Create a page', 'Select visible services', 'Publish an update'],
    note: 'Only publish information intended for your audience. Confirm email delivery configuration before relying on subscriber notifications.',
  },
  {
    slug: 'real-user-monitoring',
    name: 'Real user monitoring',
    label: 'See the experience behind the request.',
    description:
      'Explore sessions, events, frontend errors, and funnels to understand how people move through your application.',
    route: '/rum',
    guide: 'rum',
    features: [
      'Browser collection tag and application setup',
      'Sessions, users, events and funnels',
      'Replay views and frontend context',
    ],
    workflow: [
      'Create an application',
      'Configure browser collection',
      'Review sessions and events',
    ],
    note: 'Replay and analytics are early implementations. Review masking, consent, retention, and collection settings for your environment.',
  },
] as const;
export const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);
