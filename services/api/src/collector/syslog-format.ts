import type { LogLevel } from '@ape/api-contracts';
import { errorFromLog, recordToLog, type Defaults } from './formats';
import { boundAttributes, emptyBatch, parseDate, type Batch, type LogInput } from './types';

// ---------- Syslog (Heroku logplex, Render, rsyslog) ----------

export interface SyslogMessage {
  severity: number;
  ts: Date;
  hostname: string | null;
  appName: string | null;
  procId: string | null;
  structuredData: { id: string; params: Record<string, string> }[];
  message: string;
}

const SEVERITY_LEVEL: LogLevel[] = [
  'fatal',
  'fatal',
  'fatal',
  'error',
  'warn',
  'info',
  'info',
  'debug',
];
const nil = (v: string | undefined) => (v && v !== '-' ? v : null);

function parseStructuredData(s: string): { sd: SyslogMessage['structuredData']; rest: string } {
  const sd: SyslogMessage['structuredData'] = [];
  let i = 0;
  while (s[i] === '[') {
    const close = findClose(s, i);
    if (close < 0) break;
    const body = s.slice(i + 1, close);
    const sp = body.indexOf(' ');
    const id = sp < 0 ? body : body.slice(0, sp);
    const params: Record<string, string> = {};
    const re = /([^\s=]+)="((?:[^"\\]|\\.)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sp < 0 ? '' : body.slice(sp + 1))))
      params[m[1]!] = m[2]!.replace(/\\(["\\\]])/g, '$1');
    sd.push({ id, params });
    i = close + 1;
  }
  return { sd, rest: s.slice(i).replace(/^ /, '') };
}

function findClose(s: string, start: number): number {
  let inQuote = false;
  for (let i = start + 1; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') i++;
    else if (c === '"') inQuote = !inQuote;
    else if (c === ']' && !inQuote) return i;
  }
  return -1;
}

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** RFC 5424 (with or without STRUCTURED-DATA, as Heroku sends it) and RFC 3164 fallback. */
export function parseSyslog(line: string): SyslogMessage | null {
  const pri = /^<(\d{1,3})>/.exec(line);
  if (!pri) return null;
  const severity = Number(pri[1]) & 7;
  const rest = line.slice(pri[0].length);

  const v5424 = /^(\d{1,2}) (\S+) (\S+) (\S+) (\S+) (\S+) ?(.*)$/s.exec(rest);
  if (v5424) {
    // VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID, then [SD] or "-" (Heroku omits SD).
    const [, , ts, host, app, proc, , afterMsgId = ''] = v5424;
    let sd: SyslogMessage['structuredData'] = [];
    let message = afterMsgId;
    if (afterMsgId.startsWith('[')) ({ sd, rest: message } = parseStructuredData(afterMsgId));
    else if (afterMsgId.startsWith('- ') || afterMsgId === '-') message = afterMsgId.slice(2);
    return {
      severity,
      ts: parseDate(nil(ts) ?? undefined),
      hostname: nil(host),
      appName: nil(app),
      procId: nil(proc),
      structuredData: sd,
      message: message.replace(/^\uFEFF/, '').trimEnd(),
    };
  }

  // RFC 3164: "Oct 11 22:14:15 host tag[pid]: message"
  const v3164 =
    /^([A-Z][a-z]{2}) +(\d{1,2}) (\d{2}:\d{2}:\d{2}) (\S+) ([^:[\s]+)(?:\[([^\]]+)\])?: ?(.*)$/s.exec(
      rest,
    );
  if (v3164) {
    const [, mon, day, time, host, tag, pid, msg] = v3164;
    const now = new Date();
    const d = new Date(
      `${now.getUTCFullYear()}-${String(MONTHS.indexOf(mon!) + 1).padStart(2, '0')}-${day!.padStart(2, '0')}T${time}Z`,
    );
    return {
      severity,
      ts: parseDate(d.toISOString()),
      hostname: host!,
      appName: tag!,
      procId: pid ?? null,
      structuredData: [],
      message: msg!.trimEnd(),
    };
  }
  return {
    severity,
    ts: new Date(),
    hostname: null,
    appName: null,
    procId: null,
    structuredData: [],
    message: rest,
  };
}

/** The ingest token inside a syslog message: `[TOKEN@41058]`, `[x token="..."]` or `token=... `. */
export function syslogToken(m: SyslogMessage): string | null {
  for (const el of m.structuredData) {
    if (el.id.startsWith('ape_live_')) return el.id.split('@')[0]!;
    const t = el.params.token ?? el.params.apiKey ?? el.params.api_key;
    if (t?.startsWith('ape_live_')) return t;
  }
  const inMsg = /^(?:token=)?(ape_live_[A-Za-z0-9]+)\s/.exec(m.message);
  return inMsg ? inMsg[1]! : null;
}

export function syslogToLog(m: SyslogMessage, defaults: Defaults = {}): LogInput {
  // The message may itself be JSON (structured app logs); let the generic mapper read it.
  const msg = m.message.replace(/^(?:token=)?ape_live_[A-Za-z0-9]+\s/, '');
  const base = recordToLog(
    { message: msg, level: SEVERITY_LEVEL[m.severity], timestamp: m.ts.toISOString() },
    {
      service: defaults.service ?? m.appName,
      environment: defaults.environment,
    },
  );
  const attributes: Record<string, unknown> = { ...base.attributes };
  if (m.procId) attributes['process.id'] = m.procId;
  for (const el of m.structuredData)
    for (const [k, v] of Object.entries(el.params)) if (k !== 'token') attributes[`sd.${k}`] = v;
  return { ...base, host: base.host ?? m.hostname, attributes: boundAttributes(attributes) };
}

/** Heroku `application/logplex-1`: RFC 6587 octet-counted frames of syslog lines. */
export function parseOctetFrames(body: string): string[] {
  const buf = Buffer.from(body, 'utf8');
  const out: string[] = [];
  let i = 0;
  while (i < buf.length) {
    while (i < buf.length && (buf[i] === 0x0a || buf[i] === 0x0d || buf[i] === 0x20)) i++;
    if (i >= buf.length) break;
    let j = i;
    while (j < buf.length && buf[j]! >= 0x30 && buf[j]! <= 0x39) j++;
    if (j === i || buf[j] !== 0x20) {
      // Not octet-counted: treat the rest as newline-framed.
      out.push(
        ...buf
          .subarray(i)
          .toString('utf8')
          .split('\n')
          .filter((l) => l.trim()),
      );
      break;
    }
    const len = Number(buf.subarray(i, j).toString('ascii'));
    // Heroku's count includes the trailing newline.
    out.push(
      buf
        .subarray(j + 1, j + 1 + len)
        .toString('utf8')
        .replace(/\r?\n$/, ''),
    );
    i = j + 1 + len;
  }
  return out;
}

export function logplexToBatch(
  body: string,
  frameId: string | null,
  defaults: Defaults = {},
): Batch {
  const batch = emptyBatch('drain');
  parseOctetFrames(body).forEach((line, idx) => {
    const m = parseSyslog(line);
    if (!m) return;
    // Heroku puts "app" or "heroku" in APP-NAME and the dyno in PROCID; the app name comes from
    // the drain URL (?service=).
    const log = syslogToLog(
      { ...m, appName: defaults.service ?? null },
      { service: defaults.service, environment: defaults.environment },
    );
    log.attributes = { ...log.attributes, 'heroku.source': m.appName, 'heroku.dyno': m.procId };
    log.dedupKey = frameId ? `heroku:${frameId}:${idx}` : null;
    // Heroku router errors: "at=error code=H12 desc=..." are worth an incident.
    const code = /\bat=error code=(H\d+)\b.*?desc="([^"]*)"/.exec(m.message);
    if (code) {
      log.level = 'error';
      log.exception = { type: `Heroku${code[1]}`, message: code[2]!, stack: [] };
    }
    batch.logs.push(log);
    const err = errorFromLog(log, log.dedupKey);
    if (err) batch.errors.push(err);
  });
  return batch;
}
