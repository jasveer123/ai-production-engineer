import type { IngestWay, StreamState } from '@ape/api-contracts';
import type { IconName } from '@/components/ui/icon';

export type WayStatus = StreamState;

export type SendWay = {
  slug: string;

  apiWay: IngestWay;
  number: 1 | 2 | 3 | 4 | 5;
  title: string;
  subtitle: string;
  bestFor: string;
  icon: IconName;
  time: string;
  codeChange: string;
  effort: 1 | 2 | 3;
  recommended?: boolean;
};

export type SetupStep = {
  title: string;
  detail: string;
  snippets?: { label: string; code: string }[];
};

export type SnippetContext = {
  ingestUrl: string;

  token: string;
  syslog: { host: string; port: number; tls: boolean } | null;
};

export const TOKEN_PLACEHOLDER = '<your ingest token>';

export const SEND_WAYS: SendWay[] = [
  {
    slug: 'package',
    apiWay: 'package',
    number: 1,
    title: 'Our package',
    subtitle: 'One line for Node.js and Python',
    bestFor: 'new apps with no monitoring yet. Logs, traces and errors in one install.',
    icon: 'box',
    time: '2 min',
    codeChange: '1 line of code',
    effort: 1,
  },
  {
    slug: 'opentelemetry',
    apiWay: 'otlp',
    number: 2,
    title: 'OpenTelemetry',
    subtitle: 'Your app already uses OpenTelemetry',
    bestFor: 'apps that already have OpenTelemetry. Change 2 env variables, no code changes.',
    icon: 'radio',
    time: '1 min',
    codeChange: 'No code',
    effort: 1,
    recommended: true,
  },
  {
    slug: 'http-api',
    apiWay: 'http',
    number: 3,
    title: 'HTTP API',
    subtitle: 'POST JSON from anything',
    bestFor: 'any language, scripts, cron jobs, or a quick test with curl.',
    icon: 'send',
    time: '5 min',
    codeChange: 'A few lines',
    effort: 2,
  },
  {
    slug: 'server-agent',
    apiWay: 'agent',
    number: 4,
    title: 'Server agent',
    subtitle: 'Vector or Fluent Bit on your servers',
    bestFor: 'older apps, log files, Docker and Kubernetes. No code changes.',
    icon: 'server',
    time: '10 min',
    codeChange: 'No code',
    effort: 3,
  },
  {
    slug: 'log-drain',
    apiWay: 'drain',
    number: 5,
    title: 'Log drain',
    subtitle: 'Vercel, Render, Heroku',
    bestFor: 'apps on a hosting platform. Paste one URL in its settings.',
    icon: 'cloud',
    time: '1 min',
    codeChange: 'No code',
    effort: 1,
  },
];

export function getSendWay(slug: string): SendWay | undefined {
  return SEND_WAYS.find((way) => way.slug === slug);
}

export function stepsFor(slug: string, c: SnippetContext): SetupStep[] {
  const url = c.ingestUrl;
  const t = c.token;
  switch (slug) {
    case 'package':
      return [
        {
          title: 'Install the package',
          detail:
            'Pick your language. Both send logs, errors and (with OpenTelemetry installed) traces.',
          snippets: [
            { label: 'Node.js', code: 'npm install @ape/agent' },
            { label: 'Python', code: 'pip install ape-agent' },
          ],
        },
        {
          title: 'Start it before anything else',
          detail: 'First line of your entry file, so it sees every request and every crash.',
          snippets: [
            {
              label: 'server.js',
              code: `require('@ape/agent').start({ service: 'checkout-api' });`,
            },
            { label: 'main.py', code: `import ape_agent\nape_agent.start(service="checkout-api")` },
          ],
        },
        {
          title: 'Add your token and restart',
          detail:
            'Set these in the app environment, then restart. The service name is how we find the right repository.',
          snippets: [{ label: '.env', code: `APE_TOKEN=${t}\nAPE_ENDPOINT=${url}` }],
        },
        {
          title: 'Optional: report errors from your framework',
          detail: 'Express, FastAPI, Flask and Django get the failing route on every error.',
          snippets: [
            {
              label: 'Express',
              code: `app.use(require('@ape/agent').errorHandler()); // after your routes`,
            },
            {
              label: 'FastAPI',
              code: `from ape_agent.integrations import ApeASGIMiddleware\napp.add_middleware(ApeASGIMiddleware)`,
            },
          ],
        },
      ];
    case 'opentelemetry':
      return [
        {
          title: "Add these to your app's environment",
          detail:
            'Your app keeps working as before. Set OTEL_SERVICE_NAME to your service name; we use it to find the right repo.',
          snippets: [
            {
              label: '.env',
              code: `OTEL_EXPORTER_OTLP_ENDPOINT=${url}\nOTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer ${t}\nOTEL_SERVICE_NAME=checkout-api\nOTEL_RESOURCE_ATTRIBUTES=deployment.environment.name=production\nOTEL_LOGS_EXPORTER=otlp`,
            },
          ],
        },
        {
          title: 'Restart your app',
          detail:
            'The status turns green when we receive the first log, trace or metric. Protobuf and JSON both work, gzip too.',
        },
        {
          title: 'Already sending to Jaeger or Grafana?',
          detail:
            'Keep them. Add us as a second exporter in your OpenTelemetry Collector and data goes to both.',
          snippets: [
            {
              label: 'otel-collector.yaml',
              code: `exporters:\n  otlphttp/ape:\n    endpoint: ${url}\n    headers: { Authorization: "Bearer ${t}" }\nservice:\n  pipelines:\n    traces: { exporters: [otlp/jaeger, otlphttp/ape] }\n    logs: { exporters: [otlphttp/ape] }`,
            },
          ],
        },
      ];
    case 'http-api':
      return [
        {
          title: 'Send one log to test',
          detail:
            'JSON with your token in the Authorization header. A batch is a JSON array or one JSON object per line.',
          snippets: [
            {
              label: 'Terminal',
              code: `curl -X POST ${url}/v1/logs \\\n  -H "Authorization: Bearer ${t}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"message":"Checkout failed","level":"error","service":"checkout-api"}'`,
            },
          ],
        },
        {
          title: 'Report an error so it opens an incident',
          detail: 'Errors need a type; a stack trace lets the AI find the code.',
          snippets: [
            {
              label: 'Terminal',
              code: `curl -X POST ${url}/v1/errors \\\n  -H "Authorization: Bearer ${t}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"type":"TypeError","message":"coupon is null","service":"checkout-api","route":"/checkout","stack":"TypeError: coupon is null\\n    at price (src/pricing.ts:81:46)"}'`,
            },
          ],
        },
        {
          title: 'Check the answer',
          detail:
            '202 means we accepted it. 401 means the token is wrong. 413 means the batch is over 10 MB.',
        },
      ];
    case 'server-agent':
      return [
        {
          title: 'Vector: add a sink',
          detail:
            'Vector reads your log files (or Docker and Kubernetes logs) and sends them to us.',
          snippets: [
            {
              label: 'vector.yaml',
              code: `sinks:\n  ape:\n    type: http\n    inputs: [app_logs]\n    uri: ${url}/v1/logs?service=nginx-edge\n    encoding: { codec: json }\n    compression: gzip\n    auth: { strategy: bearer, token: "${t}" }`,
            },
          ],
        },
        {
          title: 'Or Fluent Bit: add an output',
          detail:
            'Same result. Records keep their fields; we read message, level and timestamp from common names.',
          snippets: [
            {
              label: 'fluent-bit.conf',
              code: `[OUTPUT]\n    Name   http\n    Match  *\n    Host   ${hostOf(url)}\n    Port   ${portOf(url)}\n    URI    /v1/logs?service=nginx-edge\n    Format json\n    tls    ${url.startsWith('https') ? 'On' : 'Off'}\n    Header Authorization Bearer ${t}`,
            },
          ],
        },
        {
          title: 'Restart the agent',
          detail:
            'systemctl restart vector (or fluent-bit), or redeploy the DaemonSet on Kubernetes.',
        },
      ];
    case 'log-drain': {
      const steps: SetupStep[] = [
        {
          title: 'Vercel',
          detail:
            'Team Settings → Drains → Add Drain → Logs → Custom endpoint. Format JSON or NDJSON. Traces: add a second drain to /v1/traces.',
          snippets: [{ label: 'Endpoint URL', code: `${url}/v1/drain?token=${t}` }],
        },
        {
          title: 'Heroku',
          detail: 'Set service= to your app name; Heroku does not send it.',
          snippets: [
            {
              label: 'Terminal',
              code: `heroku drains:add "${url.replace('://', `://ape:${t}@`)}/v1/drain?service=my-app" -a my-app`,
            },
          ],
        },
      ];
      if (c.syslog) {
        steps.push({
          title: 'Render',
          detail: `Workspace Settings → Log Streams. Render sends syslog${c.syslog.tls ? ' over TLS' : ''}; put the token in the Token field. (Render does not document where it places the token, so check the status here after saving.)`,
          snippets: [
            { label: 'Log Endpoint and Token', code: `${c.syslog.host}:${c.syslog.port}\n${t}` },
          ],
        });
      }
      return steps;
    }
    default:
      return [];
  }
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
}

function portOf(u: string): string {
  try {
    const p = new URL(u);
    return p.port || (p.protocol === 'https:' ? '443' : '80');
  } catch {
    return '443';
  }
}

export const TOOL_MONOGRAM: Record<string, string> = {
  grafana: 'Gr',
  datadog: 'Dd',
  sentry: 'Se',
  betterstack: 'Bs',
  cloudwatch: 'Cw',
  elasticsearch: 'Es',
};
