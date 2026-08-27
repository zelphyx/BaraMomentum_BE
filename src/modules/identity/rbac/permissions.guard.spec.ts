import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const makeContext = (user: unknown): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
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

  it('allows when no @Permissions decorator', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ permissions: [] }))).toBe(true);
  });

  it('allows when user has required permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['users.read']);
    expect(guard.canActivate(makeContext({ permissions: ['users.read'] }))).toBe(true);
  });

  it('throws ForbiddenException when user lacks permission', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['users.delete']);
    expect(() => guard.canActivate(makeContext({ permissions: ['users.read'] }))).toThrow(
      ForbiddenException,
    );
  });
});
