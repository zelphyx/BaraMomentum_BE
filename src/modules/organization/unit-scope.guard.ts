import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../database/prisma.service';

export const UNIT_SCOPE_KEY = 'unit:scope';

@Injectable()
export class UnitScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const unitScope = this.reflector.get<string>(UNIT_SCOPE_KEY, ctx.getHandler());
    if (!unitScope) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('Unit scope: no user');

    const userRole = user.roleCode;
    if (userRole === 'SUPER_ADMIN') return true;

    const paramId = ctx.switchToHttp().getRequest().params?.id;
    if (!paramId) return true;

    const assignments = await this.prisma.userUnitAssignment.findMany({
      where: { userId: user.sub },
      select: { organizationUnitId: true },
    });
    const allowedIds = assignments.map((a) => a.organizationUnitId);

    if (!allowedIds.includes(paramId)) {
      throw new ForbiddenException('Anda tidak memiliki akses ke unit ini');
    }
    return true;
  }
}
