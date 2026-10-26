import { createHash, createHmac } from 'node:crypto';

const sha256hex = (s: string) => createHash('sha256').update(s).digest('hex');
const hmac = (key: Buffer | string, s: string) => createHmac('sha256', key).update(s).digest();

/** AWS Signature Version 4 for a JSON POST to `host` (service `logs`). */
export function signAwsRequest(opts: {
  region: string;
  service: string;
  host: string;
  target: string;
  body: string;
  accessKeyId: string;
  secretAccessKey: string;
  now?: Date;
}): Record<string, string> {
  const now = opts.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const headers: Record<string, string> = {
    'content-type': 'application/x-amz-json-1.1',
    host: opts.host,
    'x-amz-date': amzDate,
    'x-amz-target': opts.target,
  };
  const names = Object.keys(headers).sort();
  const signedHeaders = names.join(';');
  const canonicalRequest = [
    'POST',
    '/',
    '', // no query string
    names.map((k) => `${k}:${headers[k]}\n`).join(''),
    signedHeaders,
    sha256hex(opts.body),
  ].join('\n');
  const scope = `${day}/${opts.region}/${opts.service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n');
  const kDate = hmac(`AWS4${opts.secretAccessKey}`, day);
  const kSigning = hmac(hmac(hmac(kDate, opts.region), opts.service), 'aws4_request');
  const signature = createHmac('sha256', kSigning).update(toSign).digest('hex');
  return {
    'Content-Type': headers['content-type']!,
    'X-Amz-Date': amzDate,
    'X-Amz-Target': opts.target,
    Authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}
