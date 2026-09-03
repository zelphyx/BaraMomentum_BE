import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider } from './storage-provider';
import { loadEnvConfig } from '../../../config/configuration';

@Injectable()
export class S3StorageProvider extends StorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly cdnBase: string;

  constructor() {
    super();
    const env = loadEnvConfig();
    this.client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    });
    this.bucket = env.S3_BUCKET;
    // CDN_BASE_URL may already include the bucket (`/bemfsm-media`) or not.
    // MinIO path-style access requires `/{bucket}/{key}` in the URL, so we always
    // normalize so that `this.cdnBase` ends with the bucket name.
    const rawCdn = env.CDN_BASE_URL.replace(/\/$/, '');
    if (rawCdn.endsWith(`/${this.bucket}`)) {
      this.cdnBase = rawCdn;
    } else {
      this.cdnBase = `${rawCdn}/${this.bucket}`;
    }
  }

  async put(key: string, buffer: Buffer, mime: string): Promise<{ url: string }> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mime,
        ACL: 'public-read',
      }),
    );
    return { url: `${this.cdnBase}/${key}` };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async head(key: string): Promise<{ size: number; mime: string } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return {
        size: Number(result.ContentLength ?? 0),
        mime: result.ContentType ?? 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  async getSignedUrl(key: string, ttlSeconds: number): Promise<string> {
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: ttlSeconds });
  }
}
