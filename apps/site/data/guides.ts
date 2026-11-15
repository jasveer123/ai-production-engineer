export const guides = [
  {
    slug: 'getting-started',
    title: 'Getting started',
    category: 'Start here',
    intro: 'Connect your first source, verify that data arrives, and explore your workspace.',
    sections: [
      {
        title: 'Create your workspace',
        body: 'Open the product and sign in or create an account. A new user without a workspace creates one and becomes its owner. Product URLs are configured separately from this documentation site.',
      },
      {
        title: 'Choose how to send data',
        body: 'Use the integration catalogue to choose an SDK, collector, existing log shipper, or HTTP intake. The ten published integration guides are generated from the same catalogue as the product.',
      },
      {
        title: 'Create a source token',
        body: 'In the product, open Integrations and the setup for your source. An owner or admin creates the ingest token. Store it securely; the full token is shown only when issued or rotated.',
      },
      {
        title: 'Send and verify',
        body: 'Follow the selected guide with your own ingest address and token. Check the source’s receiving state, then find the event in Logs or Live tail. A successful HTTP response and a visible event are separate checks.',
      },
      {
        title: 'Configure the response',
        body: 'Add monitors, routing, on-call schedules, escalation policies and notification channels as needed. Verify the entire flow using a controlled failure before relying on it.',
      },
    ],
  },
  {
    slug: 'tokens-and-endpoints',
    title: 'Tokens & intake endpoints',
    category: 'Start here',
    intro: 'Understand the three addresses and credentials used in integration examples.',
    sections: [
      {
        title: 'Replace the placeholders',
        body: 'YOUR_PRAMAAN_URL is the web application address. YOUR_INGEST_URL is the API or public intake address. YOUR_TOKEN is a workspace ingest token. The marketing site address is not an ingest endpoint.',
      },
      {
        title: 'Authenticate intake',
        body: 'The collector accepts ingest tokens through supported transports, including Authorization: Bearer, X-Ape-Token, supported Basic-password/query-token integrations, and syslog token fields. Prefer a header for direct HTTPS requests.',
      },
      {
        title: 'Use the correct signal endpoint',
        body: 'POST /v1/logs accepts supported OTLP or plain log formats. POST /v1/traces and /v1/metrics accept OTLP. POST /v1/errors accepts the custom error payload. POST /v1/drain handles supported hosting drains. Prometheus remote write uses /v1/prometheus/write.',
      },
      {
        title: 'Handle responses honestly',
        body: 'The HTTP log intake returns acceptance responses; protocol endpoints have their own response shapes. Check rejected data and retry guidance where available. Do not assume every successful submission has already appeared in a query.',
      },
      {
        title: 'Rotate and revoke',
        body: 'Manage tokens in the workspace. Update every collector or application after rotation. API tokens used to operate the control plane are different from ingest tokens used to send telemetry.',
      },
    ],
  },
  {
    slug: 'monitoring',
    title: 'Monitoring services',
    category: 'Product guides',
    intro: 'Create, inspect and manage checks against real service targets.',
    sections: [
      {
        title: 'Choose a check',
        body: 'The current monitor contract supports website HTTP checks, keyword checks, expected status codes, and TCP ports. Set the target, interval, timeout and failure confirmations for the chosen check.',
      },
      {
        title: 'Inspect the first result',
        body: 'New monitors begin pending. Wait for a scheduled check or use Check now. Inspect the HTTP code, timing, error, and recent check history; a pending monitor has not established availability.',
      },
      {
        title: 'Connect failure to response',
        body: 'Check the alert route and incident behavior for the monitor. Configure escalation and delivery separately. Use a controlled outage, acknowledgement and recovery to validate your deployment.',
      },
      {
        title: 'Pause, edit and recover',
        body: 'Pause checks during an intentional interruption, update the target or settings, and resume when ready. Review the next check and the associated incident timeline after recovery.',
      },
    ],
  },
  {
    slug: 'incident-response',
    title: 'Incidents, on-call & escalation',
    category: 'Product guides',
    intro: 'Follow a failure from detection to ownership and recovery.',
    sections: [
      {
        title: 'Review the incident',
        body: 'The incident page brings together severity, source context, related events, investigation and remediation information. Use the timeline to understand what was observed and what changed.',
      },
      {
        title: 'Acknowledge responsibility',
        body: 'Acknowledge an incident to record ownership and stop future escalation according to the configured policy. A message already accepted by an external provider may still arrive.',
      },
      {
        title: 'Configure on-call',
        body: 'Create a schedule, add participants and review coverage. Use overrides for temporary changes. Verify the schedule used by the policy, including boundaries and timezone behavior.',
      },
      {
        title: 'Configure escalation',
        body: 'Policies contain steps and delays. Notifications require a configured email or channel provider. Test delivery and failed-delivery behavior rather than relying on a screen that says a channel exists.',
      },
      {
        title: 'Track recovery',
        body: 'Follow alert recovery and incident updates. Response state and AI fix progress currently have overlapping concepts; inspect the timeline rather than treating a proposed patch as evidence of recovery.',
      },
    ],
  },
  {
    slug: 'telemetry',
    title: 'Exploring logs, traces & metrics',
    category: 'Product guides',
    intro: 'Find the operational evidence connected to a service or incident.',
    sections: [
      {
        title: 'Start with a source',
        body: 'Create a token and connect an integration. The source health state distinguishes recent receiving activity, an older silent source and a source that has never sent data.',
      },
      {
        title: 'Search logs',
        body: 'Use the product’s log exploration and filtering controls. Supported search includes service, environment, level, trace context and text. Select a time range that includes the event timestamp.',
      },
      {
        title: 'Follow trace context',
        body: 'Trace and span identifiers connect log events to a request. Related spans may arrive later or be incomplete because of instrumentation or sampling. Do not infer a complete request solely from one span.',
      },
      {
        title: 'Review metrics carefully',
        body: 'The product has metric storage, series and dashboard screens. Histogram preservation and counter-rate semantics are under active improvement; validate numerical behavior for your use case before using it as an operational guarantee.',
      },
    ],
  },
  {
    slug: 'error-tracking',
    title: 'Errors, releases & source maps',
    category: 'Product guides',
    intro: 'Review occurrences and their code context without losing the original error.',
    sections: [
      {
        title: 'Send exceptions',
        body: 'The Node and Python agents capture supported exceptions, and the API accepts custom error events at /v1/errors. Use the integration guide corresponding to your runtime.',
      },
      {
        title: 'Review grouped errors',
        body: 'Open Errors to inspect group counts and occurrences. Resolve or ignore groups according to your team’s workflow, and check how a new occurrence affects the state.',
      },
      {
        title: 'Attach release context',
        body: 'Supply the release value in your SDK configuration. This helps relate failures to a version rather than treating every occurrence as a new deployment regression.',
      },
      {
        title: 'Source maps',
        body: 'The application includes workspace-scoped source-map management endpoints. Match artifacts to the correct release and file identity; keep original stack traces when a map is missing.',
      },
    ],
  },
  {
    slug: 'ai-investigation',
    title: 'AI investigations & approvals',
    category: 'Product guides',
    intro: 'Use AI as an assistant with inspectable evidence and explicit write boundaries.',
    sections: [
      {
        title: 'Ask with context',
        body: 'Use Ask AI for workspace context or open an incident investigation. Repository, service and telemetry connections affect what the worker can inspect.',
      },
      {
        title: 'Inspect the evidence',
        body: 'Read the sources supporting a conclusion. Separate observations from candidate causes. Missing or stale telemetry should reduce confidence rather than be silently filled with a plausible explanation.',
      },
      {
        title: 'Review a proposed fix',
        body: 'The architecture supports isolated reproduction, patch validation and review before a pull request. Approvals should apply to the exact change and repository version being reviewed.',
      },
      {
        title: 'Deployment requirements',
        body: 'The Python worker, model provider, Temporal workers, sandbox services and repository connection must be configured for the corresponding features. A chat interface alone does not establish a completed remediation workflow.',
      },
    ],
  },
  {
    slug: 'status-pages',
    title: 'Status pages & subscribers',
    category: 'Product guides',
    intro: 'Share service health and progress with the audience that needs it.',
    sections: [
      {
        title: 'Create a public page',
        body: 'Create a status page and choose the services or monitors to show. Public naming and descriptions should be meaningful to users without exposing private infrastructure details.',
      },
      {
        title: 'Publish updates',
        body: 'Add an update with the appropriate status and message. Automatic updates depend on linked monitor transitions and the deployment’s running background services.',
      },
      {
        title: 'Subscriptions',
        body: 'Subscribers confirm their email address before receiving updates. A configured email transport is required. Verification of a subscription is different from successful notification delivery.',
      },
      {
        title: 'Custom domains',
        body: 'Use the product’s domain verification flow before binding a custom host. Configure DNS and serving infrastructure for your deployment; the marketing site does not provision domain certificates.',
      },
    ],
  },
  {
    slug: 'rum',
    title: 'Browser collection & RUM',
    category: 'Product guides',
    intro: 'Connect browser activity to sessions, frontend errors and product flows.',
    sections: [
      {
        title: 'Create an application',
        body: 'Open Real users and create a browser application. Use the app key and installation snippet shown by your own workspace instead of a shared marketing example.',
      },
      {
        title: 'Configure collection',
        body: 'Configure event and replay behavior for your application. Review masking, sensitive fields and retention before enabling recording for real users.',
      },
      {
        title: 'Explore sessions and funnels',
        body: 'Inspect sessions, users and events, then define an ordered funnel using the product controls. The current replay implementation uses periodic HTML snapshots; it is not a claim of perfect DOM replay fidelity.',
      },
      {
        title: 'Understand boundaries',
        body: 'Public application keys identify ingestion; they do not authorize reading another workspace’s sessions. Browser origin checks and server-side rate limits have different purposes.',
      },
    ],
  },
  {
    slug: 'github',
    title: 'GitHub & deployment context',
    category: 'Connections',
    intro: 'Connect code and deployment events to the investigation workflow.',
    sections: [
      {
        title: 'Install and select',
        body: 'Use the product’s GitHub App connection. Select the repositories needed for your services and review the installation status. Sign-in OAuth and repository installation serve different purposes.',
      },
      {
        title: 'Map services',
        body: 'Associate a service with its repository so an investigation can locate the relevant code. Keep repository and environment naming consistent with your telemetry.',
      },
      {
        title: 'Deployment events',
        body: 'Use the deployment webhook setup shown in Integrations. Validate the signature configuration and include the service/environment information expected by the deployment endpoint.',
      },
      {
        title: 'Review external writes',
        body: 'Creating a pull request requires the configured app permissions and explicit human approval in the remediation flow. Reading code is not permission to merge or deploy it.',
      },
    ],
  },
  {
    slug: 'notifications',
    title: 'Notification channels',
    category: 'Connections',
    intro: 'Connect incident events to the people and systems that should receive them.',
    sections: [
      {
        title: 'Choose a channel',
        body: 'The notification implementation includes Slack incoming webhooks, signed HTTP webhooks, push adapters, and Twilio SMS/phone adapters. Escalation email uses the deployment’s email transport.',
      },
      {
        title: 'Configure secrets',
        body: 'Configure channel secrets in the application and provider credentials on the deployment. Never put live tokens into public documentation or example snippets.',
      },
      {
        title: 'Validate delivery',
        body: 'Send a test notification through the workspace controls, inspect channel history, and then verify a controlled incident. Provider acceptance, delivery and acknowledgement are distinct states.',
      },
      {
        title: 'Handle failure',
        body: 'A disabled or misconfigured provider cannot page someone merely because a channel card exists. Inspect retry/failed states and operator logs for your deployment.',
      },
    ],
  },
  {
    slug: 'existing-tools',
    title: 'Connect your existing tools',
    category: 'Connections',
    intro: 'Use the implemented reader adapters without replacing every existing telemetry source.',
    sections: [
      {
        title: 'Grafana / Loki',
        body: 'The reader supports Loki query_range with bearer or basic authentication, optional organization ID and a configured service label. Configure the endpoint for your actual Loki deployment.',
      },
      {
        title: 'Datadog',
        body: 'Configure the site, API key and application key used for log search. Incoming alert integration and read-only log access are separate connections.',
      },
      {
        title: 'Sentry',
        body: 'Configure the Sentry endpoint, organization and token for issue context. This reader is separate from the product’s own custom exception ingestion.',
      },
      {
        title: 'Better Stack',
        body: 'The reader connects to a configured ClickHouse-over-HTTP query connection with username, password and a validated table identifier. Use the connection details issued by your provider.',
      },
      {
        title: 'CloudWatch',
        body: 'Configure region, read credentials and selected log groups. The reader uses signed CloudWatch requests; it is separate from streaming logs through Firehose.',
      },
      {
        title: 'Elasticsearch',
        body: 'Configure endpoint, API-key or basic authentication, index pattern and service field. Use credentials scoped to the data the investigation should read.',
      },
    ],
  },
  {
    slug: 'hosting-drains',
    title: 'Hosting drains & syslog',
    category: 'Connections',
    intro: 'Forward supported hosting events into the same workspace intake.',
    sections: [
      {
        title: 'Vercel',
        body: 'The drain adapter handles supported JSON and NDJSON log batches at /v1/drain. Use the setup flow for your project and its supported authentication/signature configuration.',
      },
      {
        title: 'Heroku',
        body: 'The adapter handles application/logplex-1 frames. Configure the drain address and token through the product setup, and check frame parsing and retry behavior with actual test traffic.',
      },
      {
        title: 'Render and syslog',
        body: 'A configured syslog listener accepts supported framed RFC 5424 messages. TLS requires deployment certificate configuration. The historical integration requirements explicitly call for verification with a real Render stream.',
      },
      {
        title: 'Verify your source',
        body: 'These are implemented adapter paths, not a claim that every provider configuration has been tested in your account. Confirm a real event in Logs and review errors before scaling traffic.',
      },
    ],
  },
] as const;
