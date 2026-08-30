import {
  IsString, IsOptional, IsEnum, IsInt, IsBoolean, IsArray, IsDateString,
  Min, Max, MinLength, MaxLength, IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum ArticleStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum ArticleVisibility {
  PUBLIC = 'PUBLIC',
  INTERNAL = 'INTERNAL',
}

export class CreateArticleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsUUID()
  coverMediaId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsOptional()
  @IsEnum(ArticleVisibility)
  visibility?: ArticleVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  coverAlt?: string;
}

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsUUID()
  coverMediaId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ArticleVisibility)
  visibility?: ArticleVisibility;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  coverAlt?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class ListArticlesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @IsOptional()
  @IsEnum(ArticleStatus)
  status?: ArticleStatus;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  authorId?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  featured?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}

export class ArticleResponseDto {
  id!: string;
  title!: string;
  slug!: string;
  excerpt!: string | null;
  content!: string;
  coverMediaId!: string | null;
  coverUrl!: string | null;
  coverWidth!: number | null;
  coverHeight!: number | null;
  categoryId!: string | null;
  authorId!: string | null;
  status!: ArticleStatus;
  visibility!: ArticleVisibility;
  isFeatured!: boolean;
  coverAlt!: string | null;
  wordCount!: number;
  readingMinutes!: number;
  publishedAt!: Date | null;
  scheduledAt!: Date | null;
  version!: number;
  createdAt!: Date;
  updatedAt!: Date;
}

export class ArticleListResponseDto {
  data!: ArticleResponseDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}
