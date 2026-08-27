import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { loadEnvConfig } from '../../config/configuration';

const env = loadEnvConfig();

@Global()
@Module({
  providers: [
    {
      provide: MailService,
      useFactory: () =>
        new MailService({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          user: env.SMTP_USER || undefined,
          password: env.SMTP_PASSWORD || undefined,
          from: env.MAIL_FROM,
        }),
    },
  ],
  exports: [MailService],
})
export class MailModule {}