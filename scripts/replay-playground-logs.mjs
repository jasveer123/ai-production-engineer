#!/usr/bin/env node
/**
 * Copies recent logs from the public VictoriaLogs playground (the OpenTelemetry Astronomy Shop
 * demo: payment, checkout, cart, product-catalog, kafka, ...) into your local workspace, so the
 * Logs page and Services discovery have realistic multi-service data to work with.
 *
 *   APE_TOKEN=ape_live_... node scripts/replay-playground-logs.mjs [--minutes 15] [--limit 2000] [--follow]
 *   node scripts/replay-playground-logs.mjs --dry-run      # fetch and map only, send nothing
 *
 * APE_URL defaults to http://localhost:4000. Lines keep their original timestamps and are tagged
 * environment "playground". These logs are almost all INFO, so they do not open incidents; use
 * demo-shop's scenarios (BUGS.md) for that.
 */
const PLAYGROUND = 'https://play-vmlogs.victoriametrics.com/select/logsql/query';
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const minutes = option('minutes', 15);
const limit = option('limit', 2000);
const dryRun = flag('dry-run');
const apeUrl = (process.env.APE_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const token = process.env.APE_TOKEN;
if (!dryRun && !token) {
  console.error('Set APE_TOKEN to your workspace token (Integrations → Send data), or use --dry-run.');
  process.exit(1);
}

/** Playground record → a line the platform's HTTP log intake understands. */
export function toIntakeLine(rec) {
  const { _msg, _time, _stream, _stream_id, ...rest } = rec;
  return {
    ...rest,
    message: _msg ?? '',
    timestamp: _time,
    service: rec['service.name'] || 'unknown',
    environment: 'playground',
  };
}

async function fetchSince(since) {
  const window = since ? `_time:>${since}` : `_time:${minutes}m`;
  const body = new URLSearchParams({ query: `${window} service.name:* | sort by (_time) | limit ${limit}` });
  const res = await fetch(PLAYGROUND, { method: 'POST', body });
  if (!res.ok) throw new Error(`playground answered ${res.status}: ${await res.text()}`);
  const text = await res.text();
  return text
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

async function send(lines) {
  for (let i = 0; i < lines.length; i += 500) {
    const chunk = lines.slice(i, i + 500);
    const res = await fetch(`${apeUrl}/v1/logs`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/x-ndjson' },
      body: chunk.map((l) => JSON.stringify(l)).join('\n'),
    });
    if (!res.ok) throw new Error(`platform answered ${res.status}: ${await res.text()}`);
  }
}

let since = null;
do {
  const records = await fetchSince(since);
  const lines = records.map(toIntakeLine);
  const services = new Set(lines.map((l) => l.service));
  if (dryRun) {
    console.log(`${lines.length} lines from ${services.size} services: ${[...services].join(', ')}`);
    if (lines[0]) console.log('first line:', JSON.stringify(lines[0]).slice(0, 400));
  } else if (lines.length) {
    await send(lines);
    console.log(`${new Date().toISOString()} sent ${lines.length} lines from ${services.size} services`);
  }
  if (records.length) since = records[records.length - 1]._time;
  if (flag('follow')) await new Promise((r) => setTimeout(r, 20_000));
} while (flag('follow') && !dryRun);
