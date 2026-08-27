import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { loadEnvConfig } from '../../../config/configuration';

const env = loadEnvConfig();

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roleCode: string;
  permissions: string[];
  unitScopes: string[];
  passwordMustChange: boolean;
}

export interface PreviewTokenPayload {
  articleId: string;
  scope: 'preview';
}

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  signAccess(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: env.JWT_ACCESS_SECRET,
      expiresIn: env.JWT_ACCESS_TTL,
    });
  }

  verifyAccess(token: string): AccessTokenPayload {
    return this.jwt.verify(token, { secret: env.JWT_ACCESS_SECRET }) as AccessTokenPayload;
  }

  signPreview(payload: PreviewTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: env.PREVIEW_TOKEN_SECRET,
      expiresIn: '15m',
    });
  }

  verifyPreview(token: string): PreviewTokenPayload {
    return this.jwt.verify(token, { secret: env.PREVIEW_TOKEN_SECRET }) as PreviewTokenPayload;
  }
}