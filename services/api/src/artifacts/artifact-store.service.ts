import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ENV, type ApiEnv } from '../config/config.module';

/** Evidence bundles and reports in S3-compatible storage. References look like s3://bucket/key. */
@Injectable()
export class ArtifactStore implements OnModuleInit {
  private readonly logger = new Logger(ArtifactStore.name);
  private readonly s3: S3Client;
  readonly bucket: string;

  constructor(@Inject(ENV) env: ApiEnv) {
    this.bucket = env.S3_BUCKET;
    this.s3 = new S3Client({
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
      ...(env.S3_ACCESS_KEY && env.S3_SECRET_KEY
        ? { credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY } }
        : {}),
    });
  }

  /** Creates the bucket on first start (there is no init container for RustFS). */
  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created bucket ${this.bucket}`);
      } catch (err) {
        this.logger.warn(`Object storage unavailable: ${(err as Error).message}`);
      }
    }
  }

  async putJson(key: string, data: unknown): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: JSON.stringify(data, null, 1),
        ContentType: 'application/json',
      }),
    );
    return `s3://${this.bucket}/${key}`;
  }

  async putBytes(key: string, body: Buffer, contentType: string): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return `s3://${this.bucket}/${key}`;
  }

  async putText(key: string, body: string, contentType = 'text/plain'): Promise<string> {
    return this.putBytes(key, Buffer.from(body), contentType);
  }

  async getText(ref: string): Promise<string> {
    const m = /^s3:\/\/([^/]+)\/(.+)$/.exec(ref);
    if (!m || m[1] !== this.bucket)
      throw new Error(`Not an artifact reference in ${this.bucket}: ${ref}`);
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: m[2] }));
    return res.Body!.transformToString();
  }

  async getJson<T>(ref: string): Promise<T> {
    const m = /^s3:\/\/([^/]+)\/(.+)$/.exec(ref);
    if (!m || m[1] !== this.bucket)
      throw new Error(`Not an artifact reference in ${this.bucket}: ${ref}`);
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: m[2] }));
    return JSON.parse(await res.Body!.transformToString()) as T;
  }
}
