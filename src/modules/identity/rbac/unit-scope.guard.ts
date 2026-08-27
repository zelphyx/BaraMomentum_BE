import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UNIT_SCOPE_KEY } from './unit-scope.decorator';

@Injectable()
export class UnitScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const bodyField = this.reflector.getAllAndOverride<string>(UNIT_SCOPE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!bodyField) return true;

    const req = ctx.switchToHttp().getRequest();
    const userScopes: string[] = req.user?.unitScopes ?? [];
    const bodyUnitIds: string[] = req.body?.[bodyField] ?? [];
    if (!Array.isArray(bodyUnitIds) || bodyUnitIds.length === 0) return true;

    const allInScope = bodyUnitIds.every((id: string) => userScopes.includes(id));
    if (!allInScope) throw new ForbiddenException('Unit scope violation');
    return true;
  }
}