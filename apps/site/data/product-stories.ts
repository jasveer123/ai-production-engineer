export interface ProductStory {
  problemTitle: string;
  problem: string;
  capabilities: { title: string; body: string }[];
  incident: string;
}

export const productStories: Record<string, ProductStory> = {
  monitoring: {
    problemTitle: 'Most outages are noticed by customers first.',
    problem:
      'A service can return errors for minutes before anyone looks at a dashboard. Uptime monitoring checks your endpoints from the outside, the same way your users reach them, so a failure is noticed when it starts rather than when the support queue fills up.',
    capabilities: [
      {
        title: 'Checks that match how you serve traffic',
        body: 'HTTP checks with an expected status, keyword checks on the response body and TCP checks for services that are not web endpoints.',
      },
      {
        title: 'Fewer false alarms',
        body: 'Choose how often each target is checked and how many failures confirm a problem, so one slow response does not wake anyone up.',
      },
      {
        title: 'A history you can read',
        body: 'Run a check by hand, pause a monitor during planned work and review past responses and timings before you decide what to do.',
      },
    ],
    incident:
      'A confirmed failure becomes the first entry on the incident. The response, the timing and the recent check history travel with it, so whoever picks it up starts from what was actually observed.',
  },
  'incident-response': {
    problemTitle: 'Incidents scatter across chats, pages and memory.',
    problem:
      "When something breaks, the alert lives in one tool, the conversation in another and the decisions in someone's head. Incident response keeps ownership, severity and every step of the response on one shared timeline.",
    capabilities: [
      {
        title: 'One timeline per incident',
        body: 'Each incident has a severity, an owner and an event timeline that records alerts, acknowledgements and updates in order.',
      },
      {
        title: 'The right person is paged',
        body: 'Escalation policies decide who is notified and when, and acknowledgement shows the team that someone has taken ownership.',
      },
      {
        title: 'Rotations that reflect real life',
        body: 'On-call schedules with overrides for holidays, swaps and sick days, so the rota matches who is actually available.',
      },
    ],
    incident:
      "Monitors and alerts open the incident, responders acknowledge it, and the AI engineer's findings land on the same timeline. When it closes, the record already explains what happened.",
  },
  telemetry: {
    problemTitle: 'The answer is usually in the logs, somewhere.',
    problem:
      'Finding the one request that failed means searching across services, hosts and formats. Logs and traces bring structured events and request paths into one place, so you can go from a symptom to the line that explains it.',
    capabilities: [
      {
        title: 'Search and live tail',
        body: 'Query structured fields instead of grepping text, or follow events as they arrive while you reproduce a problem.',
      },
      {
        title: 'Follow a request end to end',
        body: 'Trace views show which services a request passed through and where time was spent, with per-service context alongside.',
      },
      {
        title: 'Send data the way you already do',
        body: 'Ingest over HTTP, through an SDK, from a collector or with OTLP, so you can start without rewriting your logging.',
      },
    ],
    incident:
      'During an investigation the relevant logs and traces are pulled into the incident and cited, so a conclusion always points back to the events it came from.',
  },
  errors: {
    problemTitle: 'The same exception, a thousand times, with no story.',
    problem:
      'Raw error streams repeat the same failure over and over and hide what is new. Error tracking groups occurrences into issues with release context, so you can see when a problem started and whether a fix held.',
    capabilities: [
      {
        title: 'Grouped, not flooded',
        body: 'Occurrences of the same failure are collected into one error group with the detail of each individual event.',
      },
      {
        title: 'A workflow for every error',
        body: 'Resolve what is fixed, ignore what is expected and get told when a resolved error comes back as a regression.',
      },
      {
        title: 'Readable stack traces',
        body: 'Release context and source-map endpoints connect minified frontend errors back to the code that threw them.',
      },
    ],
    incident:
      'An error spike linked to a release gives the investigation a starting point, and the next occurrence after a fix shows whether the change actually worked.',
  },
  'ai-investigation': {
    problemTitle: 'Investigation is the slowest part of every incident.',
    problem:
      'Engineers spend most of an incident gathering context: reading logs, comparing deploys and opening code. The AI engineer does that legwork, explains what it found with links to the evidence and drafts a change for a person to review.',
    capabilities: [
      {
        title: 'Ask in plain language',
        body: 'Workspace chat and incident investigations let you ask what changed, what is failing and why, in the context of your own systems.',
      },
      {
        title: 'Every claim is linked',
        body: 'Explanations cite the logs, traces, deploys and code they rely on, so you can check the reasoning instead of trusting it.',
      },
      {
        title: 'A fix you approve',
        body: 'Candidate changes are validated in isolation and go through a human-approved pull request workflow before anything ships.',
      },
    ],
    incident:
      'The investigation runs on the incident record. Its findings, the proposed change and the review decision all stay there for the next person who needs them.',
  },
  'status-pages': {
    problemTitle: 'Silence during an outage costs more trust than the outage.',
    problem:
      'Customers want to know whether a problem is known and being worked on. Status pages give them a public place for updates that is connected to the services you already monitor.',
    capabilities: [
      {
        title: 'Pages built from your services',
        body: 'Choose which services appear and link them to monitors, so the page reflects what you actually watch.',
      },
      {
        title: 'Updates and history',
        body: 'Post status updates during an incident and keep a service history that shows how reliable things have been.',
      },
      {
        title: 'Subscribers and your domain',
        body: 'Visitors can subscribe after confirming their address, and the page can be served from your own custom domain.',
      },
    ],
    incident:
      'While the team investigates, a short update tells customers the problem is known. When the fix is verified, the same page records that it is over.',
  },
  'real-user-monitoring': {
    problemTitle: 'Server metrics can look fine while users struggle.',
    problem:
      'A healthy backend does not mean a working product. Real user monitoring shows what people experience in the browser: the pages they visit, the errors they hit and where they drop out of a flow.',
    capabilities: [
      {
        title: 'Set up in the browser',
        body: 'Create an application and add the collection tag to start receiving sessions from real visitors.',
      },
      {
        title: 'Sessions, users and funnels',
        body: 'Explore sessions and events by user, and build funnels to see which step of a journey loses people.',
      },
      {
        title: 'Context for frontend errors',
        body: 'Replay views and frontend context show what a user did before an error, which makes it easier to reproduce.',
      },
    ],
    incident:
      'When an incident affects users, sessions from the affected period show its real impact and give the investigation a view the server logs cannot.',
  },
};
