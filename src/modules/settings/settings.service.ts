import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export const SITE_SETTINGS_KEYS = [
  'site.name',
  'cabinet.name',
  'site.tagline',
  'site.description',
  'site.email',
  'site.phone',
  'site.url',
  'site.address',
  'social.instagram',
  'social.instagramUrl',
  'social.youtube',
  'social.youtubeUrl',
  'social.twitter',
  'social.tiktok',
  'seo.defaultTitle',
  'seo.defaultDescription',
  'settings.maxHighlightsPerPlacement',
  'footer.copyright',
  'footer.disclaimer',
] as const;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async get(keys: string[]): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany({
      where: { key: { in: keys } },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  async bulkSet(settings: Record<string, string>): Promise<void> {
    await this.prisma.$transaction(
      Object.entries(settings).map(([key, value]) =>
        this.prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value },
        }),
      ),
    );
  }
}
