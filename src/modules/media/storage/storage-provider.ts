export abstract class StorageProvider {
  abstract put(key: string, buffer: Buffer, mime: string): Promise<{ url: string }>;
  abstract delete(key: string): Promise<void>;
  abstract head(key: string): Promise<{ size: number; mime: string } | null>;
  abstract getSignedUrl(key: string, ttlSeconds: number): Promise<string>;
}
