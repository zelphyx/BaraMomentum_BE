import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MediaService } from '../media.service';

@Injectable()
export class MediaCleanupJob {
  private readonly logger = new Logger(MediaCleanupJob.name);

  constructor(private readonly media: MediaService) {}

  // 02:00 WIB = 19:00 UTC previous day
  // TZ env is Asia/Jakarta, so "0 2 * * *" runs at 02:00 WIB
  @Cron('0 2 * * *', { name: 'media-cleanup' })
  async handleOrphanCleanup() {
    this.logger.log('Starting media orphan cleanup...');
    try {
      const count = await this.media.cleanupOrphans();
      this.logger.log(`Media orphan cleanup complete. Removed ${count} orphaned assets.`);
    } catch (err) {
      this.logger.error('Media orphan cleanup failed', err);
    }
  }
}
