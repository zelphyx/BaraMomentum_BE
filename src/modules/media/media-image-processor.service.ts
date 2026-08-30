import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import * as crypto from 'crypto';

export type ImageVariant = 'cover' | 'logo' | 'photo' | 'inline' | 'avatar';

interface VariantConfig {
  maxWidth: number;
  maxHeight: number;
  keepAspect: boolean;
  quality: number;
  preservePng: boolean;
}

const VARIANTS: Record<ImageVariant, VariantConfig> = {
  cover: { maxWidth: 1600, maxHeight: 900, keepAspect: true, quality: 82, preservePng: false },
  logo: { maxWidth: 512, maxHeight: 512, keepAspect: true, quality: 90, preservePng: true },
  photo: { maxWidth: 800, maxHeight: 1000, keepAspect: true, quality: 82, preservePng: false },
  inline: { maxWidth: 1200, maxHeight: 1200, keepAspect: true, quality: 82, preservePng: false },
  avatar: { maxWidth: 256, maxHeight: 256, keepAspect: true, quality: 82, preservePng: false },
};

export interface ProcessedImage {
  buffer: Buffer;
  mime: string;
  width: number;
  height: number;
  checksum: string;
}

@Injectable()
export class ImageProcessorService {
  async process(
    buffer: Buffer,
    variant: ImageVariant,
    mimeType: string,
  ): Promise<ProcessedImage> {
    const cfg = VARIANTS[variant];
    if (!cfg) throw new Error(`Unknown variant: ${variant}`);

    let pipeline = sharp(buffer).rotate();

    if (cfg.preservePng && mimeType === 'image/png') {
      const pngMeta = await sharp(buffer).metadata();
      if (pngMeta.width && pngMeta.height && pngMeta.width <= cfg.maxWidth && pngMeta.height <= cfg.maxHeight) {
        const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
        return { buffer, mime: 'image/png', width: pngMeta.width, height: pngMeta.height, checksum };
      }
      pipeline = pipeline.resize(cfg.maxWidth, cfg.maxHeight, { fit: 'inside', withoutEnlargement: true });
      const out = await pipeline.png({ quality: cfg.quality }).toBuffer();
      const hash = crypto.createHash('sha256').update(out).digest('hex');
      const outMeta = await sharp(out).metadata();
      return { buffer: out, mime: 'image/png', width: outMeta.width ?? 0, height: outMeta.height ?? 0, checksum: hash };
    }

    pipeline = pipeline.resize(cfg.maxWidth, cfg.maxHeight, { fit: 'inside', withoutEnlargement: true });
    const out = await pipeline.webp({ quality: cfg.quality }).toBuffer();
    const checksum = crypto.createHash('sha256').update(out).digest('hex');
    const outMeta = await sharp(out).metadata();

    return {
      buffer: out,
      mime: 'image/webp',
      width: outMeta.width ?? 0,
      height: outMeta.height ?? 0,
      checksum,
    };
  }

  async probeMetadata(buffer: Buffer): Promise<{ width: number; height: number; mime: string }> {
    const meta = await sharp(buffer).metadata();
    const raw = await sharp(buffer).toBuffer();
    const detected = this.detectMime(raw.subarray(0, 12));
    return {
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      mime: meta.format ?? detected,
    };
  }

  private detectMime(bytes: Buffer): string {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp';
    return 'application/octet-stream';
  }

  detectMimeType(buffer: Buffer): string {
    return this.detectMime(buffer.subarray(0, 12));
  }
}
