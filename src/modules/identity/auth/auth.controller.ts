import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard, Public } from './jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import {
  RequestMeta,
  RequestMetaInfo,
} from '../../../common/decorators/request-meta.decorator';
import { loadEnvConfig } from '../../../config/configuration';

const env = loadEnvConfig();
const REFRESH_COOKIE = 'refresh_token';

const readRefreshToken = (req: Request, body?: string): string => {
  if (env.AUTH_MODE === 'cookie') {
    const cookies = (req as unknown as { cookies?: Record<string, string> }).cookies ?? {};
    return cookies[REFRESH_COOKIE] ?? '';
  }
  return body ?? '';
};

const setRefreshCookie = (res: Response, token: string): void => {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const clearRefreshCookie = (res: Response): void => {
  res.clearCookie(REFRESH_COOKIE, {
    path: '/api/v1/auth',
    domain: env.COOKIE_DOMAIN || undefined,
  });
};

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @RequestMeta() meta: RequestMetaInfo,
  ) {
    const result = await this.auth.login({
      email: dto.email,
      password: dto.password,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    if (env.AUTH_MODE === 'cookie') {
      setRefreshCookie(res, result.refreshToken);
    }
    return { ...result.user, accessToken: result.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @RequestMeta() meta: RequestMetaInfo,
  ) {
    const token = readRefreshToken(req, dto.refreshToken);
    const result = await this.auth.refresh(token, meta);
    if (env.AUTH_MODE === 'cookie') {
      setRefreshCookie(res, result.refreshToken);
    }
    return { ...result.user, accessToken: result.accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: AuthenticatedUser,
    @RequestMeta() meta: RequestMetaInfo,
  ) {
    const token = readRefreshToken(req, dto.refreshToken);
    await this.auth.logout(token, user?.sub ?? null, meta);
    if (env.AUTH_MODE === 'cookie') {
      clearRefreshCookie(res);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestMeta() meta: RequestMetaInfo,
  ) {
    await this.auth.changePassword(user.sub, dto.currentPassword, dto.newPassword, meta);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @RequestMeta() meta: RequestMetaInfo) {
    await this.auth.forgotPassword(dto.email, meta);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async resetPassword(@Body() dto: ResetPasswordDto, @RequestMeta() meta: RequestMetaInfo) {
    await this.auth.resetPassword(dto.token, dto.newPassword, meta);
  }
}