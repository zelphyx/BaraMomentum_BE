import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { loadEnvConfig } from '../../../config/configuration';
import { TokenService, AccessTokenPayload } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  const env = loadEnvConfig();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: env.JWT_ACCESS_SECRET,
          signOptions: { expiresIn: env.JWT_ACCESS_TTL },
        }),
      ],
      providers: [TokenService],
    }).compile();
    service = module.get(TokenService);
  });

  const payload: AccessTokenPayload = {
    sub: 'u-1',
    email: 'a@b.c',
    roleCode: 'SUPER_ADMIN',
    permissions: ['users.read'],
    unitScopes: [],
    passwordMustChange: false,
  };

  it('signAccess creates JWT', () => {
    const token = service.signAccess(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);
  });

  it('verifyAccess returns payload', () => {
    const token = service.signAccess(payload);
    const verified = service.verifyAccess(token);
    expect(verified.sub).toBe(payload.sub);
    expect(verified.permissions).toEqual(payload.permissions);
  });

  it('verifyAccess throws on tampered token', () => {
    const token = service.signAccess(payload);
    expect(() => service.verifyAccess(token + 'x')).toThrow();
  });
});