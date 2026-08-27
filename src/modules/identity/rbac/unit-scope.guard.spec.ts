import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UnitScopeGuard } from './unit-scope.guard';

describe('UnitScopeGuard', () => {
  let guard: UnitScopeGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new UnitScopeGuard(reflector);
  });

  const makeContext = (user: unknown, body: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user, body }),
        getResponse: () => ({}),
        getNext: () => () => undefined,
      }),
      getHandler: () => ({}) as any,
      getClass: () => ({}) as any,
      getArgs: () => [],
      getArgByIndex: () => undefined,
      switchToRpc: () => ({}) as any,
      switchToWs: () => ({}) as any,
      getType: () => 'http',
    }) as unknown as ExecutionContext;

  it('allows when no @UnitScope decorator', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ unitScopes: [] }, {}))).toBe(true);
  });

  it('allows when all body unit ids are in user scopes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('unitIds');
    expect(
      guard.canActivate(makeContext({ unitScopes: ['u-1', 'u-2'] }, { unitIds: ['u-1'] })),
    ).toBe(true);
  });

  it('throws when body unit id not in user scopes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('unitIds');
    expect(() =>
      guard.canActivate(makeContext({ unitScopes: ['u-1'] }, { unitIds: ['u-1', 'u-3'] })),
    ).toThrow(ForbiddenException);
  });

  it('allows when body has no unit ids', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue('unitIds');
    expect(guard.canActivate(makeContext({ unitScopes: [] }, {}))).toBe(true);
  });
});
