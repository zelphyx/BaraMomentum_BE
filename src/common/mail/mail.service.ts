import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface MailConfig {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(config: MailConfig) {
    this.fromAddress = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      auth:
        config.user && config.password ? { user: config.user, pass: config.password } : undefined,
    });
  }

  async send(msg: MailMessage): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
    } catch (err) {
      this.logger.error(`Mail send failed: ${(err as Error).message}`);
      throw err;
    }
  }
}
