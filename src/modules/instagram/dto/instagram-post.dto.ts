import { Type } from 'class-transformer';
import {
  IsString, IsOptional, IsEnum, IsInt, IsArray, IsUUID,
  Min, Max, MaxLength, MinLength, Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InstagramContentType,
  InstagramPostStatus,
  InstagramPlacementType,
} from '@prisma/client';

// ============================================================
// Enums (re-exported for DTOs)
// ============================================================

export { InstagramContentType, InstagramPostStatus, InstagramPlacementType };

// ============================================================
// Create
// ============================================================

export class CreateInstagramPostDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  @Matches(/^https?:\/\/(www\.)?instagram\.com\/p\/[A-Za-z0-9_-]+(\/.*)?$/, {
    message: 'canonicalUrl must be a valid Instagram post URL',
  })
  canonicalUrl!: string;

  @ApiPropertyOptional({ enum: InstagramPostStatus })
  @IsOptional()
  @IsEnum(InstagramPostStatus)
  status?: InstagramPostStatus;
}

// ============================================================
// Update
// ============================================================

export class UpdateInstagramPostDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  @Matches(/^https?:\/\/(www\.)?instagram\.com\/p\/[A-Za-z0-9_-]+(\/.*)?$/, {
    message: 'canonicalUrl must be a valid Instagram post URL',
  })
  canonicalUrl?: string;

  @ApiPropertyOptional({ enum: InstagramPostStatus })
  @IsOptional()
  @IsEnum(InstagramPostStatus)
  status?: InstagramPostStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNote?: string;
}

// ============================================================
// List / Query
// ============================================================

export class ListInstagramPostsDto {
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
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: InstagramPlacementType })
  @IsOptional()
  @IsEnum(InstagramPlacementType)
  placement?: InstagramPlacementType;

  @ApiPropertyOptional({ enum: InstagramPostStatus })
  @IsOptional()
  @IsEnum(InstagramPostStatus)
  status?: InstagramPostStatus;
}

// ============================================================
// Toggle Highlight
// ============================================================

export class ToggleHighlightDto {
  @ApiProperty({ enum: InstagramPlacementType })
  @IsEnum(InstagramPlacementType)
  placement!: InstagramPlacementType;
}

// ============================================================
// Bulk Reorder
// ============================================================

export class ReorderPostsDto {
  @ApiProperty({ enum: InstagramPlacementType })
  @IsEnum(InstagramPlacementType)
  placement!: InstagramPlacementType;

  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @IsUUID('4', { each: true })
  orderedIds!: string[];
}

// ============================================================
// Response DTOs
// ============================================================

export class InstagramPlacementResponseDto {
  id!: string;
  placement!: InstagramPlacementType;
  isHighlighted!: boolean;
  sortOrder!: number;
}

export class InstagramPostResponseDto {
  id!: string;
  canonicalUrl!: string;
  shortcode!: string;
  internalTitle!: string | null;
  contentType!: InstagramContentType;
  status!: InstagramPostStatus;
  internalNote!: string | null;
  placements!: InstagramPlacementResponseDto[];
  createdAt!: Date;
  updatedAt!: Date;
}

export class InstagramPostListItemDto {
  id!: string;
  canonicalUrl!: string;
  shortcode!: string;
  internalTitle!: string | null;
  contentType!: InstagramContentType;
  status!: InstagramPostStatus;
  placements!: InstagramPlacementResponseDto[];
  createdAt!: Date;
  updatedAt!: Date;
}

export class InstagramPostListResponseDto {
  data!: InstagramPostListItemDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}
