# @ape/agent

Send logs, errors and traces from a Node.js app (JavaScript or TypeScript, Node 18+) to AI Production Engineer. This is **Way 1** on the Integrations page.

## Install

```bash
npm install @ape/agent
```

## Start it before anything else

```js
// server.js (CommonJS): the very first line
require('@ape/agent').start({ service: 'checkout-api' });
```

```ts
// server.ts (ESM / TypeScript): import it first
import { start } from '@ape/agent';
start({ service: 'checkout-api' });
```

No code change at all: `NODE_OPTIONS="--require @ape/agent/register" node server.js`.

| Setting | Env var | Default |
|---|---|---|
| `token` | `APE_TOKEN` | required |
| `endpoint` | `APE_ENDPOINT` | `http://localhost:4000` |
| `service` | `APE_SERVICE`, `OTEL_SERVICE_NAME` | package name |
| `environment` | `APE_ENVIRONMENT`, `NODE_ENV` | `production` |
| `release` | `APE_RELEASE` | none |
| `captureConsole` | | `true` |
| `captureUncaught` | | `true` |
| `tracing` | | `true` when the OpenTelemetry SDK is installed |
| `minLevel` | | `info` |

## What it sends

- **Logs**: `console.log/info/warn/error/debug`, plus `log(level, message, attributes)`.
- **Errors**: uncaught exceptions and unhandled rejections (the process still exits as Node normally would), plus `captureException(err, context)`.
- **Traces**: install `@opentelemetry/sdk-node` and `@opentelemetry/exporter-trace-otlp-http` (and optionally `@opentelemetry/auto-instrumentations-node`). The agent starts them pointed at the same endpoint and token, and adds the active trace id to every log line.

```js
const ape = require('@ape/agent');
app.use(ape.errorHandler()); // Express: after your routes, reports 5xx errors
ape.captureException(err, { route: '/checkout', orderId });
await ape.shutdown(); // flush before a controlled exit
```

## Safety

- Never throws into your app. Problems are printed once to stderr with an `[ape-agent]` prefix.
- Passwords, tokens, keys, card numbers and URL credentials are removed **before** data leaves the process; the server redacts again.
- Batches of up to 100 items every 2 s, at most 10 000 queued (the oldest are dropped), retries on network errors, 429 and 5xx, and turns itself off if the token is rejected.
