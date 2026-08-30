import { Test } from '@nestjs/testing';
import { ImageProcessorService, ImageVariant } from './media-image-processor.service';
import sharp from 'sharp';

describe('ImageProcessorService', () => {
  let service: ImageProcessorService;

  let pngBuffer: Buffer;
  let jpegBuffer: Buffer;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [ImageProcessorService],
    }).compile();
    service = module.get(ImageProcessorService);

    pngBuffer = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: { r: 128, g: 128, b: 128 } } })
      .png()
      .toBuffer();
    jpegBuffer = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: { r: 128, g: 128, b: 128 } } })
      .jpeg()
      .toBuffer();
  });

  describe('detectMimeType', () => {
    it('detects JPEG magic bytes', () => {
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      expect(service.detectMimeType(jpeg)).toBe('image/jpeg');
    });

    it('detects PNG magic bytes', () => {
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      expect(service.detectMimeType(png)).toBe('image/png');
    });

    it('returns octet-stream for unknown', () => {
      const unknown = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      expect(service.detectMimeType(unknown)).toBe('application/octet-stream');
    });
  });

  describe('process', () => {
    it('resizes PNG cover to max 1600x900 WebP', async () => {
      const result = await service.process(pngBuffer, 'cover' as ImageVariant, 'image/png');
      expect(result.mime).toBe('image/webp');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.checksum).toHaveLength(64);
      expect(result.width).toBeLessThanOrEqual(1600);
      expect(result.height).toBeLessThanOrEqual(900);
    });

    it('converts JPEG to WebP inline', async () => {
      const result = await service.process(jpegBuffer, 'inline' as ImageVariant, 'image/jpeg');
      expect(result.mime).toBe('image/webp');
      expect(result.checksum).toHaveLength(64);
    });

    it('preserves PNG for logo variant', async () => {
      const result = await service.process(pngBuffer, 'logo' as ImageVariant, 'image/png');
      expect(result.mime).toBe('image/png');
    });

    it('generates checksum as SHA-256 hex', async () => {
      const result = await service.process(pngBuffer, 'cover' as ImageVariant, 'image/png');
      expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it('throws for unknown variant', async () => {
      await expect(service.process(pngBuffer, 'unknown' as ImageVariant, 'image/png')).rejects.toThrow('Unknown variant');
    });
  });
});
