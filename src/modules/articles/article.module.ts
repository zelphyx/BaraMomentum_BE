import { Module } from '@nestjs/common';
import { ArticleController } from './article.controller';
import { ArticleService } from './article.service';
import { ArticleRepository } from './article.repository';
import { ArticleSanitizerService } from './article-sanitizer.service';
import { ArticlePublisherJob } from './jobs/article-publisher.job';
import { PrismaModule } from '../../database/prisma.module';
import { IdentityModule } from '../identity/identity.module';

@Module({
  imports: [PrismaModule, IdentityModule],
  controllers: [ArticleController],
  providers: [
    ArticleService,
    ArticleRepository,
    ArticleSanitizerService,
    ArticlePublisherJob,
  ],
})
export class ArticleModule {}
