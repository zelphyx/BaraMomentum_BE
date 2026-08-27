import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { JwtAuthGuard, Public } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { RequestMeta, RequestMetaInfo } from '../../../common/decorators/request-meta.decorator';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('users.invite')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async create(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() actor: AuthenticatedUser,
    @RequestMeta() meta: RequestMetaInfo,
  ) {
    return this.invitations.create(dto.email, dto.roleCode, dto.name, actor.sub, meta);
  }

  @Public()
  @Post('accept')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async accept(@Body() dto: AcceptInvitationDto, @RequestMeta() meta: RequestMetaInfo) {
    return this.invitations.accept(dto.token, dto.password, meta);
  }
}
