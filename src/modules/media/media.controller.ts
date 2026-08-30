import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { MediaService } from './media.service';
import { ListMediaDto, MediaVariant } from './dto/media.dto';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import { PermissionsGuard } from '../identity/rbac/permissions.guard';
import { Permissions } from '../identity/rbac/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
 
@Controller('media')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post()
  @Permissions('media.upload')
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('variant') variant: string = 'inline',
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const v = (variant as MediaVariant) || MediaVariant.INLINE;
    return this.media.upload(file, v, user.sub);
  }

  @Get()
  @Permissions('media.read')
  async list(@Query() query: ListMediaDto) {
    return this.media.list(query);
  }

  @Get(':id')
  @Permissions('media.read')
  async get(@Param('id') id: string) {
    return this.media.get(id);
  }

  @Patch(':id')
  @Permissions('media.update')
  async update(@Param('id') id: string, @Body() body: { alt?: string }) {
    return this.media.update(id, body);
  }

  @Delete(':id')
  @Permissions('media.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.media.delete(id, user.sub);
  }
}
