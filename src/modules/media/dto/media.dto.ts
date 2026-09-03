import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export enum MediaVariant {
  COVER = 'cover',
  LOGO = 'logo',
  PHOTO = 'photo',
  INLINE = 'inline',
  AVATAR = 'avatar',
}

export class ListMediaDto {
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
  @IsEnum(MediaVariant)
  variant?: MediaVariant;
}

export class MediaResponseDto {
  id!: string;
  filename!: string;
  originalName!: string;
  mimeType!: string;
  size!: number;
  width!: number | null;
  height!: number | null;
  url!: string;
  variant!: string;
  alt!: string | null;
  uploadedById!: string | null;
  uploadedBy?: { id: string; email: string; name: string } | null;
  usageCount!: number;
  createdAt!: Date;
}

export class MediaListResponseDto {
  data!: MediaResponseDto[];
  total!: number;
  page!: number;
  pageSize!: number;
}
