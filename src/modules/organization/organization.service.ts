import { BadRequestException, ConflictException, Injectable, NotFoundException, PreconditionFailedException } from '@nestjs/common';
import { UnitRepository, UnitWithRelations } from './unit.repository';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateUnitDto, UpdateUnitDto, ListUnitsDto, ReorderUnitsDto,
  UnitResponseDto, StrategyResponseDto, ProgramResponseDto, MemberResponseDto, UnitListItemDto,
} from './dto/unit.dto';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly repo: UnitRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list(dto: ListUnitsDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const { data, total } = await this.repo.findMany({ ...dto, page, pageSize });
    return {
      data: data.map((u) => this.toListItem(u)),
      total,
      page,
      pageSize,
    };
  }

  async get(id: string): Promise<UnitResponseDto> {
    const unit = await this.repo.findById(id);
    if (!unit || unit.deletedAt) throw new NotFoundException('Unit tidak ditemukan');
    return this.toResponse(unit);
  }

  async getBySlug(slug: string): Promise<UnitResponseDto> {
    const unit = await this.repo.findBySlug(slug);
    if (!unit || unit.deletedAt || unit.status !== 'PUBLISHED') {
      throw new NotFoundException('Unit tidak ditemukan');
    }
    return this.toResponse(unit);
  }

  async create(dto: CreateUnitDto, actorId: string): Promise<UnitResponseDto> {
    if (RESERVED_SLUGS.includes(dto.slug)) {
      throw new BadRequestException(`Slug '${dto.slug}' adalah reserved route`);
    }
    const existing = await this.repo.findBySlug(dto.slug);
    if (existing) throw new ConflictException('Slug unit sudah ada');

    const unit = await this.prisma.$transaction(async (tx) => {
      const u = await tx.organizationUnit.create({
        data: {
          id: uuidv4(),
          name: dto.name,
          slug: dto.slug,
          shortName: dto.shortName ?? null,
          type: dto.type,
          logoMediaId: dto.logoMediaId ?? null,
          summary: dto.summary ?? null,
          description: dto.description ?? null,
          status: dto.status ?? 'DRAFT',
          sortOrder: dto.sortOrder ?? 0,
          seoTitle: dto.seoTitle ?? null,
          seoDesc: dto.seoDesc ?? null,
          createdById: actorId,
          updatedById: actorId,
        },
      });
      if (dto.strategies?.length) {
        await tx.unitStrategy.createMany({
          data: dto.strategies.map((s) => ({ id: s.id ?? uuidv4(), organizationUnitId: u.id, content: s.content, sortOrder: s.sortOrder })),
        });
      }
      if (dto.programs?.length) {
        await tx.unitProgram.createMany({
          data: dto.programs.map((p) => ({
            id: p.id ?? uuidv4(), organizationUnitId: u.id,
            name: p.name, description: p.description ?? null,
            scheduleLabel: p.scheduleLabel ?? null, externalUrl: p.externalUrl ?? null,
            status: p.status ?? 'PLANNED', sortOrder: p.sortOrder,
          })),
        });
      }
      if (dto.members?.length) {
        await tx.unitMember.createMany({
          data: dto.members.map((m) => ({
            id: m.id ?? uuidv4(), organizationUnitId: u.id,
            name: m.name, role: m.role,
            photoMediaId: m.photoMediaId ?? null, photoAlt: m.photoAlt ?? null,
            instagramUrl: m.instagramUrl ?? null, linkedinUrl: m.linkedinUrl ?? null,
            sortOrder: m.sortOrder, isActive: m.isActive ?? true,
          })),
        });
      }
      return u;
    });

    const full = await this.repo.findById(unit.id);
    return this.toResponse(full!);
  }

  async update(id: string, dto: UpdateUnitDto, actorId: string): Promise<UnitResponseDto> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundException('Unit tidak ditemukan');

    if (dto.slug !== undefined && dto.slug !== existing.slug) {
      if (RESERVED_SLUGS.includes(dto.slug)) throw new BadRequestException(`Slug '${dto.slug}' adalah reserved route`);
      const slugExists = await this.repo.findBySlug(dto.slug);
      if (slugExists) throw new ConflictException('Slug unit sudah ada');
    }

    await this.prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = { updatedById: actorId };
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.slug !== undefined) updateData.slug = dto.slug;
      if (dto.shortName !== undefined) updateData.shortName = dto.shortName ?? null;
      if (dto.type !== undefined) updateData.type = dto.type;
      if (dto.logoMediaId !== undefined) updateData.logoMediaId = dto.logoMediaId ?? null;
      if (dto.summary !== undefined) updateData.summary = dto.summary ?? null;
      if (dto.description !== undefined) updateData.description = dto.description ?? null;
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.sortOrder !== undefined) updateData.sortOrder = dto.sortOrder;
      if (dto.seoTitle !== undefined) updateData.seoTitle = dto.seoTitle ?? null;
      if (dto.seoDesc !== undefined) updateData.seoDesc = dto.seoDesc ?? null;

      await tx.organizationUnit.update({ where: { id }, data: updateData });

      if (dto.strategies !== undefined) {
        await tx.unitStrategy.deleteMany({ where: { organizationUnitId: id } });
        if (dto.strategies.length > 0) {
          await tx.unitStrategy.createMany({
            data: dto.strategies.map((s) => ({ id: s.id ?? uuidv4(), organizationUnitId: id, content: s.content, sortOrder: s.sortOrder })),
          });
        }
      }
      if (dto.programs !== undefined) {
        await tx.unitProgram.deleteMany({ where: { organizationUnitId: id } });
        if (dto.programs.length > 0) {
          await tx.unitProgram.createMany({
            data: dto.programs.map((p) => ({
              id: p.id ?? uuidv4(), organizationUnitId: id,
              name: p.name, description: p.description ?? null,
              scheduleLabel: p.scheduleLabel ?? null, externalUrl: p.externalUrl ?? null,
              status: p.status ?? 'PLANNED', sortOrder: p.sortOrder,
            })),
          });
        }
      }
      if (dto.members !== undefined) {
        await tx.unitMember.deleteMany({ where: { organizationUnitId: id } });
        if (dto.members.length > 0) {
          await tx.unitMember.createMany({
            data: dto.members.map((m) => ({
              id: m.id ?? uuidv4(), organizationUnitId: id,
              name: m.name, role: m.role,
              photoMediaId: m.photoMediaId ?? null, photoAlt: m.photoAlt ?? null,
              instagramUrl: m.instagramUrl ?? null, linkedinUrl: m.linkedinUrl ?? null,
              sortOrder: m.sortOrder, isActive: m.isActive ?? true,
            })),
          });
        }
      }
    });

    const updated = await this.repo.findById(id);
    return this.toResponse(updated!);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing || existing.deletedAt) throw new NotFoundException('Unit tidak ditemukan');
    await this.repo.softDelete(id);
  }

  async publish(id: string): Promise<UnitResponseDto> {
    const unit = await this.repo.findById(id);
    if (!unit || unit.deletedAt) throw new NotFoundException('Unit tidak ditemukan');
    if (unit.status === 'PUBLISHED') throw new BadRequestException('Unit sudah dipublikasikan');
    await this.repo.validatePublishRequirements(unit);
    const updated = await this.repo.update(id, { status: 'PUBLISHED' } as unknown as never);
    const full = await this.repo.findById(updated.id);
    return this.toResponse(full!);
  }

  async archive(id: string): Promise<UnitResponseDto> {
    const unit = await this.repo.findById(id);
    if (!unit || unit.deletedAt) throw new NotFoundException('Unit tidak ditemukan');
    if (unit.status === 'ARCHIVED') throw new BadRequestException('Unit sudah diarsipkan');
    const updated = await this.repo.update(id, { status: 'ARCHIVED' } as unknown as never);
    const full = await this.repo.findById(updated.id);
    return this.toResponse(full!);
  }

  async reorder(dto: ReorderUnitsDto): Promise<void> {
    await this.prisma.$transaction(
      dto.orderedIds.map((id, index) =>
        this.prisma.organizationUnit.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
  }

  async listPublic() {
    const { data } = await this.repo.findMany({ status: 'PUBLISHED', page: 1, pageSize: 100 });
    return data.map((u) => this.toListItem(u));
  }

  async getMetrics() {
    const [published, draft, archived] = await Promise.all([
      this.repo.countByStatus('PUBLISHED'),
      this.repo.countByStatus('DRAFT'),
      this.repo.countByStatus('ARCHIVED'),
    ]);
    return { published, draft, archived, total: published + draft + archived };
  }

  private toListItem(u: { id: string; slug: string; name: string; shortName: string | null; type: string; summary: string | null; sortOrder: number; status: string; logoMedia?: { id: string; url: string } | null; createdAt: Date; updatedAt: Date }): UnitListItemDto {
    return {
      id: u.id,
      slug: u.slug,
      name: u.name,
      shortName: u.shortName,
      type: u.type as never,
      summary: u.summary,
      logo: u.logoMedia ? { id: u.logoMedia.id, url: u.logoMedia.url } : null,
      status: u.status as never,
      sortOrder: u.sortOrder,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }

  private toResponse(u: UnitWithRelations): UnitResponseDto {
    return {
      id: u.id,
      slug: u.slug,
      name: u.name,
      shortName: u.shortName,
      type: u.type as never,
      logoMediaId: u.logoMediaId,
      logo: u.logoMedia ? { id: u.logoMedia.id, url: u.logoMedia.url } : null,
      summary: u.summary,
      description: u.description,
      status: u.status as never,
      sortOrder: u.sortOrder,
      seoTitle: u.seoTitle,
      seoDesc: u.seoDesc,
      strategies: u.strategies.map((s) => ({ id: s.id, content: s.content, sortOrder: s.sortOrder })),
      programs: u.programs.map((p) => ({ id: p.id, name: p.name, description: p.description, scheduleLabel: p.scheduleLabel, externalUrl: p.externalUrl, status: p.status as never, sortOrder: p.sortOrder })),
      members: u.members.map((m) => ({ id: m.id, name: m.name, role: m.role, photoMediaId: m.photoMediaId, photo: m.photoMedia ? { id: m.photoMedia.id, url: m.photoMedia.url, alt: m.photoMedia.alt } : null, photoAlt: m.photoAlt, instagramUrl: m.instagramUrl, linkedinUrl: m.linkedinUrl, sortOrder: m.sortOrder, isActive: m.isActive })),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    };
  }
}

const RESERVED_SLUGS = ['admin', 'api', 'informasi', 'tentang', 'new', 'create', 'edit'];
import { v4 as uuidv4 } from 'uuid';
