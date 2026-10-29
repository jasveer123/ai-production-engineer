import { createRequire } from 'node:module';
import { join } from 'node:path';

const appRequire = createRequire(join(process.cwd(), 'noop.js'));

function tryRequire<T>(name: string): T | null {
  try {
    return appRequire(name) as T;
  } catch {
    return null;
  }
}

interface OtelApi {
  trace: { getActiveSpan(): { spanContext(): { traceId: string; spanId: string } } | undefined };
}

let api: OtelApi | null | undefined;

export function activeTraceContext(): { traceId: string; spanId: string } | null {
  if (api === undefined) api = tryRequire<OtelApi>('@opentelemetry/api');
  const ctx = api?.trace.getActiveSpan()?.spanContext();
  if (!ctx || /^0+$/.test(ctx.traceId)) return null;
  return { traceId: ctx.traceId, spanId: ctx.spanId };
}

export interface TracingOptions {
  endpoint: string;
  token: string;
  service: string;
  environment: string;
  release: string | null;
  sdkHeader: string;
  warn: (m: string) => void;
}

export function startTracing(o: TracingOptions): (() => Promise<void>) | null {
  const sdkNode = tryRequire<{
    NodeSDK: new (cfg: Record<string, unknown>) => { start(): void; shutdown(): Promise<void> };
  }>('@opentelemetry/sdk-node');
  const exporterPkg = tryRequire<{
    OTLPTraceExporter: new (cfg: Record<string, unknown>) => unknown;
  }>('@opentelemetry/exporter-trace-otlp-http');
  if (!sdkNode || !exporterPkg) return null;

  const instrumentations: unknown[] = [];
  const auto = tryRequire<{ getNodeAutoInstrumentations: (c?: unknown) => unknown[] }>(
    '@opentelemetry/auto-instrumentations-node',
  );
  if (auto)
    instrumentations.push(
      ...auto.getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    );
  else {
    const http = tryRequire<{ HttpInstrumentation: new () => unknown }>(
      '@opentelemetry/instrumentation-http',
    );
    const express = tryRequire<{ ExpressInstrumentation: new () => unknown }>(
      '@opentelemetry/instrumentation-express',
    );
    if (http) instrumentations.push(new http.HttpInstrumentation());
    if (express) instrumentations.push(new express.ExpressInstrumentation());
  }

  const attrs = [
    `service.name=${o.service}`,
    `deployment.environment.name=${o.environment}`,
    ...(o.release ? [`service.version=${o.release}`] : []),
  ];
  process.env.OTEL_RESOURCE_ATTRIBUTES = [process.env.OTEL_RESOURCE_ATTRIBUTES, ...attrs]
    .filter(Boolean)
    .join(',');
  process.env.OTEL_SERVICE_NAME ??= o.service;

  try {
    const sdk = new sdkNode.NodeSDK({
      traceExporter: new exporterPkg.OTLPTraceExporter({
        url: `${o.endpoint}/v1/traces`,
        headers: { Authorization: `Bearer ${o.token}`, 'x-ape-sdk': o.sdkHeader },
      }),
      instrumentations,
    });
    sdk.start();
    return () => sdk.shutdown();
  } catch (err) {
    o.warn(`tracing did not start: ${(err as Error).message}`);
    return null;
  }
}
