import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MediaService } from '../media.service';

@Injectable()
export class MediaCleanupJob {
  private readonly logger = new Logger(MediaCleanupJob.name);

  constructor(private readonly media: MediaService) {}

  // 02:00 WIB daily: hard-delete soft-deleted assets that have been orphaned > 7 days.
  @Cron('0 2 * * *', { name: 'media-cleanup-orphans' })
  async handleOrphanCleanup() {
    this.logger.log('Starting media orphan cleanup...');
    try {
      const count = await this.media.cleanupOrphans();
      this.logger.log(`Media orphan cleanup complete. Removed ${count} orphaned assets.`);
    } catch (err) {
      this.logger.error('Media orphan cleanup failed', err);
    }
  }

  // 03:00 WIB daily: hard-delete uploads older than 24h that were never assigned
  // anywhere. Prevents S3 bloat from admin uploads that got abandoned mid-edit.
  @Cron('0 3 * * *', { name: 'media-cleanup-abandoned' })
  async handleAbandonedCleanup() {
    this.logger.log('Starting media abandoned-upload cleanup...');
    try {
      const count = await this.media.cleanupAbandoned(24);
      this.logger.log(`Media abandoned-upload cleanup complete. Removed ${count} assets.`);
    } catch (err) {
      this.logger.error('Media abandoned-upload cleanup failed', err);
    }
  }
}
