import {
  booleanFlag,
  boundedInt,
  optionalText,
  optionalUrl,
  positiveInt,
  text,
  urlWithDefault,
} from './helpers';

export const telemetryEnv = {
  OTEL_EXPORTER_OTLP_ENDPOINT: urlWithDefault('http://localhost:4318'),
  OTEL_ENABLED: booleanFlag.default('true'),
  PUBLIC_INGEST_URL: optionalUrl,
  INGEST_MAX_BODY_MB: boundedInt(1, 50, 10),
  LOG_RETENTION_DAYS: boundedInt(1, 365, 7),
  INGEST_WORKER_ENABLED: booleanFlag.default('true'),
  INGEST_POLL_INTERVAL_MS: positiveInt(1000),
  SYSLOG_ENABLED: booleanFlag.default('true'),
  SYSLOG_PORT: positiveInt(6514),
  SYSLOG_PUBLIC_HOST: text('localhost'),
  SYSLOG_TLS_CERT_PATH: optionalText,
  SYSLOG_TLS_KEY_PATH: optionalText,
  JAEGER_QUERY_URL: urlWithDefault('http://localhost:16686'),
  JAEGER_UI_URL: urlWithDefault('http://localhost:16686'),
  JAEGER_POLL_INTERVAL_MS: positiveInt(15_000),
};
