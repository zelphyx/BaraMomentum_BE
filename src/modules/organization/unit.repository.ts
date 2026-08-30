import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationUnit, UnitType, UnitStatus, Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const RESERVED_SLUGS = ['admin', 'api', 'informasi', 'tentang', 'new', 'create', 'edit'];

export type UnitWithRelations = Prisma.OrganizationUnitGetPayload<{
  include: {
    logoMedia: { select: { id: true; url: true; alt: true } };
    strategies: true;
    programs: true;
    members: { where: { isActive: true }; include: { photoMedia: { select: { id: true; url: true; alt: true } } } };
  };
}>;

@Injectable()
export class UnitRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.OrganizationUnitUncheckedCreateInput): Promise<OrganizationUnit> {
    return this.prisma.organizationUnit.create({ data });
  }

  async findById(id: string): Promise<UnitWithRelations | null> {
    return this.prisma.organizationUnit.findUnique({
      where: { id },
      include: {
        logoMedia: { select: { id: true, url: true, alt: true } },
        strategies: { orderBy: { sortOrder: 'asc' } },
        programs: { orderBy: { sortOrder: 'asc' } },
        members: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: { photoMedia: { select: { id: true, url: true, alt: true } } },
        },
      },
    });
  }

  async findBySlug(slug: string): Promise<UnitWithRelations | null> {
    return this.prisma.organizationUnit.findUnique({
      where: { slug },
      include: {
        logoMedia: { select: { id: true, url: true, alt: true } },
        strategies: { orderBy: { sortOrder: 'asc' } },
        programs: { orderBy: { sortOrder: 'asc' } },
        members: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: { photoMedia: { select: { id: true, url: true, alt: true } } },
        },
      },
    });
  }

  async findMany(params: {
    type?: UnitType;
    status?: UnitStatus;
    search?: string;
    page: number;
    pageSize: number;
    includeDeleted?: boolean;
  }): Promise<{ data: OrganizationUnit[]; total: number }> {
    const { type, status, search, page, pageSize, includeDeleted } = params;
    const where: Prisma.OrganizationUnitWhereInput = {
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(search ? { OR: [{ name: { contains: search } }, { slug: { contains: search } }] } : {}),
      ...(includeDeleted ? {} : { deletedAt: null }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.organizationUnit.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { sortOrder: 'asc' },
        include: { logoMedia: { select: { id: true, url: true, alt: true } } },
      }),
      this.prisma.organizationUnit.count({ where }),
    ]);
    return { data, total };
  }

  async update(id: string, data: Prisma.OrganizationUnitUpdateInput): Promise<OrganizationUnit> {
    return this.prisma.organizationUnit.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<OrganizationUnit> {
    return this.prisma.organizationUnit.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async updateSortOrder(id: string, sortOrder: number): Promise<void> {
    await this.prisma.organizationUnit.update({ where: { id }, data: { sortOrder } });
  }

  async findStrategies(unitId: string) {
    return this.prisma.unitStrategy.findMany({
      where: { organizationUnitId: unitId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upsertStrategies(unitId: string, strategies: { id?: string; content: string; sortOrder: number }[]) {
    await this.prisma.unitStrategy.deleteMany({ where: { organizationUnitId: unitId } });
    if (strategies.length === 0) return;
    await this.prisma.unitStrategy.createMany({
      data: strategies.map((s) => ({ id: s.id ?? uuidv4(), organizationUnitId: unitId, content: s.content, sortOrder: s.sortOrder })),
    });
  }

  async findPrograms(unitId: string) {
    return this.prisma.unitProgram.findMany({
      where: { organizationUnitId: unitId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upsertPrograms(unitId: string, programs: { id?: string; name: string; description?: string | null; scheduleLabel?: string | null; externalUrl?: string | null; status?: string; sortOrder: number }[]) {
    await this.prisma.unitProgram.deleteMany({ where: { organizationUnitId: unitId } });
    if (programs.length === 0) return;
    await this.prisma.unitProgram.createMany({
      data: programs.map((p) => ({
        id: p.id ?? uuidv4(),
        organizationUnitId: unitId,
        name: p.name,
        description: p.description ?? null,
        scheduleLabel: p.scheduleLabel ?? null,
        externalUrl: p.externalUrl ?? null,
        status: (p.status as 'PLANNED' | 'ACTIVE' | 'COMPLETED') ?? 'PLANNED',
        sortOrder: p.sortOrder,
      })),
    });
  }

  async findMembers(unitId: string) {
    return this.prisma.unitMember.findMany({
      where: { organizationUnitId: unitId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { photoMedia: { select: { id: true, url: true, alt: true } } },
    });
  }

  async upsertMembers(unitId: string, members: {
    id?: string;
    name: string;
    role: string;
    photoMediaId?: string | null;
    photoAlt?: string | null;
    instagramUrl?: string | null;
    linkedinUrl?: string | null;
    sortOrder: number;
    isActive?: boolean;
  }[]) {
    await this.prisma.unitMember.deleteMany({ where: { organizationUnitId: unitId } });
    if (members.length === 0) return;
    await this.prisma.unitMember.createMany({
      data: members.map((m) => ({
        id: m.id ?? uuidv4(),
        organizationUnitId: unitId,
        name: m.name,
        role: m.role,
        photoMediaId: m.photoMediaId ?? null,
        photoAlt: m.photoAlt ?? null,
        instagramUrl: m.instagramUrl ?? null,
        linkedinUrl: m.linkedinUrl ?? null,
        sortOrder: m.sortOrder,
        isActive: m.isActive ?? true,
      })),
    });
  }

  async countByStatus(status: UnitStatus): Promise<number> {
    return this.prisma.organizationUnit.count({ where: { status, deletedAt: null } });
  }

  async validatePublishRequirements(unit: OrganizationUnit & { logoMedia?: { id: string; url: string } | null }): Promise<void> {
    const errors: string[] = [];
    if (!unit.name?.trim()) errors.push('name');
    if (!unit.shortName?.trim()) errors.push('shortName');
    if (!unit.type) errors.push('type');
    if (!unit.slug?.trim()) errors.push('slug');
    if (!unit.logoMediaId) errors.push('logoMediaId');
    if (!unit.summary?.trim()) errors.push('summary');
    if (!unit.description?.trim()) errors.push('description');
    if (errors.length > 0) {
      throw new BadRequestException({ code: 'MISSING_PUBLISH_REQUIREMENTS', message: `Field wajib belum diisi: ${errors.join(', ')}`, fields: errors });
    }
  }
}
