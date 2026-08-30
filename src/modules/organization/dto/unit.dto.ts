import { Type } from 'class-transformer';
import { IsOptional, IsString, IsEnum, IsInt, Min, IsBoolean, IsUrl, IsArray, ValidateNested, MinLength, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UnitType, UnitStatus, ProgramStatus } from '@prisma/client';

function IsSlug(validationOptions?: { message?: string }) {
  return IsString(validationOptions);
}

export class StrategyDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  content!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ProgramDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  scheduleLabel?: string;

  @IsOptional()
  @IsUrl()
  externalUrl?: string;

  @IsOptional()
  @IsEnum(ProgramStatus)
  status?: ProgramStatus;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class MemberDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  role!: string;

  @IsOptional()
  @IsUUID()
  photoMediaId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  photoAlt?: string;

  @IsOptional()
  @IsUrl()
  instagramUrl?: string;

  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateUnitDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsSlug()
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string;

  @ApiProperty({ enum: UnitType })
  @IsEnum(UnitType)
  type!: UnitType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  logoMediaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: UnitStatus })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDesc?: string;

  @ApiPropertyOptional({ type: [StrategyDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyDto)
  strategies?: StrategyDto[];

  @ApiPropertyOptional({ type: [ProgramDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramDto)
  programs?: ProgramDto[];

  @ApiPropertyOptional({ type: [MemberDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberDto)
  members?: MemberDto[];
}

export class UpdateUnitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsSlug()
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  shortName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  logoMediaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: UnitStatus })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  seoTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  seoDesc?: string;

  @ApiPropertyOptional({ type: [StrategyDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyDto)
  strategies?: StrategyDto[];

  @ApiPropertyOptional({ type: [ProgramDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramDto)
  programs?: ProgramDto[];

  @ApiPropertyOptional({ type: [MemberDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MemberDto)
  members?: MemberDto[];
}

export class ListUnitsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: UnitType })
  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;

  @ApiPropertyOptional({ enum: UnitStatus })
  @IsOptional()
  @IsEnum(UnitStatus)
  status?: UnitStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}

export class ReorderUnitsDto {
  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds!: string[];
}

export class StrategyResponseDto {
  id!: string;
  content!: string;
  sortOrder!: number;
}

export class ProgramResponseDto {
  id!: string;
  name!: string;
  description!: string | null;
  scheduleLabel!: string | null;
  externalUrl!: string | null;
  status!: ProgramStatus;
  sortOrder!: number;
}

export class MemberResponseDto {
  id!: string;
  name!: string;
  role!: string;
  photoMediaId!: string | null;
  photo!: { id: string; url: string; alt: string | null } | null;
  photoAlt!: string | null;
  instagramUrl!: string | null;
  linkedinUrl!: string | null;
  sortOrder!: number;
  isActive!: boolean;
}

export class UnitListItemDto {
  id!: string;
  slug!: string;
  name!: string;
  shortName!: string | null;
  type!: UnitType;
  summary!: string | null;
  logo!: { id: string; url: string } | null;
  status!: UnitStatus;
  sortOrder!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class UnitResponseDto {
  id!: string;
  slug!: string;
  name!: string;
  shortName!: string | null;
  type!: UnitType;
  logoMediaId!: string | null;
  logo!: { id: string; url: string } | null;
  summary!: string | null;
  description!: string | null;
  status!: UnitStatus;
  sortOrder!: number;
  seoTitle!: string | null;
  seoDesc!: string | null;
  strategies!: StrategyResponseDto[];
  programs!: ProgramResponseDto[];
  members!: MemberResponseDto[];
  createdAt!: Date;
  updatedAt!: Date;
}
