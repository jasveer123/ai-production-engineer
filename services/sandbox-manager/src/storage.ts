import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import * as tar from 'tar';
import { workRoot } from './runner';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'ape-minio',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'ape-minio-secret',
  },
});
const bucket = () => process.env.S3_BUCKET ?? 'ape-artifacts';

function keyOf(ref: string): string {
  const m = /^s3:\/\/([^/]+)\/(.+)$/.exec(ref);
  if (!m || m[1] !== bucket()) throw new Error(`Not an artifact reference: ${ref}`);
  return m[2]!;
}

export async function getJson<T>(ref: string): Promise<T> {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: keyOf(ref) }));
  return JSON.parse(await res.Body!.transformToString()) as T;
}

export async function putJson(key: string, data: unknown): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    }),
  );
  return `s3://${bucket()}/${key}`;
}

/**
 * Downloads a source tarball (GitHub's format: one top-level directory) and extracts it once per
 * reference. Extraction refuses absolute paths, `..` and links, so a hostile archive can't write
 * outside its directory.
 */
export async function materializeSource(sourceRef: string): Promise<string> {
  const dir = join(
    workRoot(),
    'src',
    createHash('sha256').update(sourceRef).digest('hex').slice(0, 24),
  );
  if (existsSync(join(dir, '.ape-complete'))) return dir;
  const tmp = `${dir}.tmp-${process.pid}`;
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: keyOf(sourceRef) }));
  await pipeline(
    res.Body as Readable,
    tar.x({
      cwd: tmp,
      strip: 1,
      preservePaths: false,
      filter: (path, entry) => {
        const type = (entry as { type?: string }).type;
        return !path.split('/').includes('..') && type !== 'SymbolicLink' && type !== 'Link';
      },
    }),
  );
  await import('node:fs/promises').then((fs) => fs.writeFile(join(tmp, '.ape-complete'), ''));
  rmSync(dir, { recursive: true, force: true });
  renameSync(tmp, dir);
  return dir;
}
