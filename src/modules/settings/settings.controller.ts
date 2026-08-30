import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { SettingsService, SITE_SETTINGS_KEYS } from './settings.service';
import { UpdateSettingDto, BulkUpdateSettingsDto } from './dto/settings.dto';
import { JwtAuthGuard, Public } from '../identity/auth/jwt-auth.guard';
import { PermissionsGuard } from '../identity/rbac/permissions.guard';
import { Permissions } from '../identity/rbac/permissions.decorator';

// Public settings — only expose safe public keys.
const PUBLIC_SETTINGS_KEYS = [
  'site.name',
  'cabinet.name',
  'site.tagline',
  'site.email',
  'site.url',
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
] as const;

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('settings.read')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async getAll() {
    return this.settings.getAll();
  }

  @Patch()
  @Permissions('settings.update')
  async bulkUpdate(@Body() dto: BulkUpdateSettingsDto) {
    await this.settings.bulkSet(dto.settings);
    return this.settings.getAll();
  }
}

@Controller('public/settings')
@Public()
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async getPublic() {
    const all = await this.settings.getAll();
    const public_ = Object.fromEntries(
      Object.entries(all).filter(([k]) => (PUBLIC_SETTINGS_KEYS as readonly string[]).includes(k)),
    );
    return public_;
  }
}
