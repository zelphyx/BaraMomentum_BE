import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { MediaRepository } from './media.repository';
import { ImageProcessorService, ImageVariant } from './media-image-processor.service';
import { STORAGE_TOKEN } from './storage/storage.provider';
import { StorageProvider } from './storage/storage-provider';
import { ListMediaDto, MediaResponseDto, MediaVariant } from './dto/media.dto';

const MAX_SIZES: Record<MediaVariant, number> = {
  [MediaVariant.COVER]: 8 * 1024 * 1024,
  [MediaVariant.LOGO]: 5 * 1024 * 1024,
  [MediaVariant.PHOTO]: 5 * 1024 * 1024,
  [MediaVariant.INLINE]: 5 * 1024 * 1024,
  [MediaVariant.AVATAR]: 2 * 1024 * 1024,
};

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

@Injectable()
export class MediaService {
  constructor(
    private readonly repo: MediaRepository,
    private readonly imageProcessor: ImageProcessorService,
    @Inject(STORAGE_TOKEN) private readonly storage: StorageProvider,
  ) {}

  async upload(
    file: Express.Multer.File,
    variant: MediaVariant,
    uploadedById: string | null,
  ): Promise<MediaResponseDto> {
    if (!file) throw new BadRequestException('No file uploaded');

    const maxSize = MAX_SIZES[variant];
    if (file.size > maxSize) {
      throw new BadRequestException(`File too large. Max ${maxSize / 1024 / 1024}MB for ${variant}`);
    }

    const mime = this.imageProcessor.detectMimeType(file.buffer);
    if (!ALLOWED_MIMES.includes(mime)) {
      throw new BadRequestException('Invalid file type. Allowed: JPEG, PNG, WebP');
    }

    const processed = await this.imageProcessor.process(file.buffer, variant as ImageVariant, mime);

    const ext = processed.mime === 'image/png' ? 'png' : 'webp';
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const key = `${variant}/${year}/${month}/${uuidv4()}.${ext}`;

    const { url } = await this.storage.put(key, processed.buffer, processed.mime);

    const asset = await this.repo.create({
      id: uuidv4(),
      filename: `${uuidv4()}.${ext}`,
      originalName: file.originalname,
      mimeType: processed.mime,
      size: processed.buffer.length,
      width: processed.width,
      height: processed.height,
      checksum: processed.checksum,
      storageKey: key,
      url,
      variant,
      uploadedById,
    });

    const r = this.toResponse(asset);
    r.usageCount = 0;
    return r;
  }

  async list(dto: ListMediaDto): Promise<{ data: MediaResponseDto[]; total: number; page: number; pageSize: number }> {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const { data, total } = await this.repo.findMany({ variant: dto.variant, page, pageSize });
    const responses = await Promise.all(
      data.map(async (m) => {
        const r = this.toResponse(m);
        r.usageCount = await this.countReferences(m.id);
        return r;
      }),
    );
    return { data: responses, total, page, pageSize };
  }

  async get(id: string): Promise<MediaResponseDto> {
    const asset = await this.repo.findById(id);
    if (!asset || asset.deletedAt) throw new NotFoundException('Media not found');
    const r = this.toResponse(asset);
    r.usageCount = await this.countReferences(asset.id);
    return r;
  }

  async update(id: string, dto: { alt?: string }): Promise<MediaResponseDto> {
    const asset = await this.repo.findById(id);
    if (!asset || asset.deletedAt) throw new NotFoundException('Media not found');
    const updated = await this.repo.updateAlt(id, dto.alt ?? asset.alt ?? '');
    const r = this.toResponse(updated);
    r.usageCount = await this.countReferences(updated.id);
    return r;
  }

  async delete(id: string, actorId: string): Promise<void> {
    const asset = await this.repo.findById(id);
    if (!asset || asset.deletedAt) throw new NotFoundException('Media not found');

    const refCount = await this.countReferences(id);
    if (refCount > 0) {
      throw new ConflictException('Media is in use');
    }

    await this.repo.softDelete(id);
    await this.storage.delete(asset.storageKey);
  }

  async countReferences(mediaId: string): Promise<number> {
    const [articleCovers, unitLogos, memberPhotos, avatarCount] = await Promise.all([
      this.repo.countByField('Article', 'coverMediaId', mediaId),
      this.repo.countByField('OrganizationUnit', 'logoMediaId', mediaId),
      this.repo.countByField('UnitMember', 'photoMediaId', mediaId),
      this.repo.countByField('User', 'avatarMediaId', mediaId),
    ]);
    return articleCovers + unitLogos + memberPhotos + avatarCount;
  }

  async cleanupOrphans(): Promise<number> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const orphans = await this.repo.findDeletedBefore(cutoff);
    let count = 0;
    for (const asset of orphans) {
      const refCount = await this.countReferences(asset.id);
      if (refCount === 0) {
        await this.storage.delete(asset.storageKey);
        await this.repo.hardDelete(asset.id);
        count++;
      }
    }
    return count;
  }

  /**
   * Cleanup "abandoned uploads": admin uploaded media that was never assigned to
   * any article/unit/member/avatar within ABANDONED_HOURS. Runs daily at 03:00 WIB
   * so stale uploads don't accumulate in S3.
   */
  async cleanupAbandoned(abandonedHours = 24): Promise<number> {
    const cutoff = new Date(Date.now() - abandonedHours * 60 * 60 * 1000);
    const candidates = await this.repo.findActiveUnreferencedOlderThan(cutoff);
    let count = 0;
    for (const asset of candidates) {
      const refCount = await this.countReferences(asset.id);
      if (refCount === 0) {
        await this.storage.delete(asset.storageKey);
        await this.repo.hardDelete(asset.id);
        count++;
      }
    }
    return count;
  }

  private toResponse(asset: { id: string; filename: string; originalName: string; mimeType: string; size: number; width: number | null; height: number | null; url: string; variant: string; alt: string | null; uploadedById: string | null; uploadedBy?: { id: string; email: string; name: string } | null; createdAt: Date }): MediaResponseDto {
    return {
      id: asset.id,
      filename: asset.filename,
      originalName: asset.originalName,
      mimeType: asset.mimeType,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      url: asset.url,
      variant: asset.variant,
      alt: asset.alt ?? null,
      uploadedById: asset.uploadedById,
      uploadedBy: asset.uploadedBy ?? null,
      usageCount: 0,
      createdAt: asset.createdAt,
    };
  }
}
