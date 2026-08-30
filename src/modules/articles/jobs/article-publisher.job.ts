import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ArticleService } from '../article.service';

@Injectable()
export class ArticlePublisherJob {
  private readonly logger = new Logger(ArticlePublisherJob.name);

  constructor(private readonly articles: ArticleService) {}

  @Cron('*/5 * * * *', { name: 'article-publisher' })
  async handleScheduledPublish() {
    try {
      const count = await this.articles.publishScheduled();
      if (count > 0) {
        this.logger.log(`Published ${count} scheduled article(s)`);
      }
    } catch (err) {
      this.logger.error('Scheduled article publish failed', err);
    }
  }
}
