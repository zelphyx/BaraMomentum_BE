import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequestMeta, RequestMetaInfo } from '../../../common/decorators/request-meta.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Permissions('users.read')
  async list(@Query() query: ListUsersDto) {
    return this.users.list(query);
  }

  @Post()
  @Permissions('users.create')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @RequestMeta() meta: RequestMetaInfo,
  ) {
    const { user, tempPassword } = await this.users.create(dto, actor.sub, meta);
    return { user, tempPassword };
  }

  @Patch(':id')
  @Permissions('users.update')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
    @RequestMeta() meta: RequestMetaInfo,
  ) {
    return this.users.update(id, dto, actor.sub, meta);
  }

  @Delete(':id')
  @Permissions('users.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @RequestMeta() meta: RequestMetaInfo,
  ) {
    await this.users.delete(id, actor.sub, meta);
  }

  @Post(':id/revoke-sessions')
  @Permissions('users.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSessions(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
    @RequestMeta() meta: RequestMetaInfo,
  ) {
    await this.users.revokeSessions(id, actor.sub, meta);
  }
}
