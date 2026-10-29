export type FinderAnswer = 'nowhere' | 'otel' | 'files' | 'platform' | 'tool' | 'other';

export type FinderOption = { value: FinderAnswer; title: string; hint: string };

export const FINDER_OPTIONS: FinderOption[] = [
  { value: 'nowhere', title: 'Nowhere yet', hint: 'New app, no monitoring' },
  { value: 'otel', title: 'My app uses OpenTelemetry', hint: 'Or an OTel Collector' },
  { value: 'files', title: 'In files on my servers', hint: 'VMs, Docker, Kubernetes' },
  { value: 'platform', title: 'On a hosting platform', hint: 'Vercel, Render, Heroku' },
  { value: 'tool', title: 'In Grafana, Datadog or Sentry', hint: 'Keep them, connect them' },
  { value: 'other', title: 'Somewhere else', hint: 'Any language or script' },
];

export type Recommendation = {
  title: string;
  detail: string;

  href: string;
};

const RECOMMENDATIONS: Record<FinderAnswer, Recommendation> = {
  nowhere: {
    title: 'Use Way 1: our package.',
    detail: 'Install it and add one line when your app starts.',
    href: '/integrations/package/',
  },
  otel: {
    title: 'Use Way 2: OpenTelemetry.',
    detail: 'Change 2 env variables and restart. No code changes.',
    href: '/integrations/opentelemetry/',
  },
  other: {
    title: 'Use Way 3: the HTTP API.',
    detail: 'POST JSON with your token from any language or script.',
    href: '/integrations/http-api/',
  },
  files: {
    title: 'Use Way 4: a server agent.',
    detail: 'Vector or Fluent Bit reads your log files. No code changes.',
    href: '/integrations/server-agent/',
  },
  platform: {
    title: 'Use Way 5: a log drain.',
    detail: 'Paste one URL into your platform settings.',
    href: '/integrations/log-drain/',
  },
  tool: {
    title: 'Use Ways 6 and 7: connect your tool.',
    detail: 'Its alerts open incidents here, and the AI reads its logs while it investigates.',
    href: '/integrations/tools/',
  },
};

export const DEFAULT_ANSWER: FinderAnswer = 'otel';

export function recommend(answer: FinderAnswer): Recommendation {
  return RECOMMENDATIONS[answer];
}
