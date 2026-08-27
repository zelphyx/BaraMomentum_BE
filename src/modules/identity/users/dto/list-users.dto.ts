import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { UserRoleCode, UserStatus } from '@prisma/client';

export class ListUsersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsEnum(UserRoleCode)
  roleCode?: UserRoleCode;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
