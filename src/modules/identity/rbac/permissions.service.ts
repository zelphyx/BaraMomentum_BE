import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface UserPermissionsInfo {
  roleCode: string;
  permissions: string[];
  unitScopes: string[];
  passwordMustChange: boolean;
}

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async loadForUser(userId: string): Promise<UserPermissionsInfo> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { unitAssignments: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const role = await this.prisma.role.findUnique({
      where: { code: user.roleCode },
      include: { rolePermissions: { include: { permission: true } } },
    });
    const permissions = role?.rolePermissions.map((rp) => rp.permission.code) ?? [];
    const unitScopes = user.unitAssignments.map((ua) => ua.organizationUnitId);

    return {
      roleCode: user.roleCode,
      permissions,
      unitScopes,
      passwordMustChange: user.passwordMustChange,
    };
  }

  hasPermission(userPerms: string[], required: string): boolean {
    return userPerms.includes(required);
  }

  hasAnyPermission(userPerms: string[], required: string[]): boolean {
    return required.some((p) => userPerms.includes(p));
  }
}