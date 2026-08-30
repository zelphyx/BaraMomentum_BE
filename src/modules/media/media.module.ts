import { Module } from '@nestjs/common';
import * as multer from 'multer';
import { MulterModule } from '@nestjs/platform-express';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { MediaRepository } from './media.repository';
import { ImageProcessorService } from './media-image-processor.service';
import { provideStorageProvider } from './storage/storage.provider';
import { PrismaModule } from '../../database/prisma.module';
import { MediaCleanupJob } from './jobs/media-cleanup.job';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaRepository,
    ImageProcessorService,
    provideStorageProvider(),
    MediaCleanupJob,
  ],
  exports: [MediaService],
})
export class MediaModule {}
