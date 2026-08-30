import { Injectable } from '@nestjs/common';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { StorageProvider } from './storage-provider';
@Injectable()
export class LocalStorageProvider extends StorageProvider {
  private readonly baseDir: string;
  private readonly baseUrl: string;

  constructor() {
    super();
    this.baseDir = join(process.cwd(), 'uploads');
    this.baseUrl = '/uploads';
    mkdirSync(this.baseDir, { recursive: true });
  }

  private resolve(key: string): string {
    return join(this.baseDir, key);
  }

  async put(key: string, buffer: Buffer, mime: string): Promise<{ url: string }> {
    const fullPath = this.resolve(key);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, buffer);
    return { url: `${this.baseUrl}/${key}` };
  }

  async delete(key: string): Promise<void> {
    try {
      unlinkSync(this.resolve(key));
    } catch {
      // noop — already gone
    }
  }

  async head(key: string): Promise<{ size: number; mime: string } | null> {
    try {
      const stat = statSync(this.resolve(key));
      return { size: stat.size, mime: 'application/octet-stream' };
    } catch {
      return null;
    }
  }

  async getSignedUrl(key: string, _ttlSeconds: number): Promise<string> {
    return `${this.baseUrl}/${key}`;
  }
}
