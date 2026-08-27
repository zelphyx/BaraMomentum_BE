import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRoleCode, UserStatus } from '@prisma/client';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(UserRoleCode)
  roleCode?: UserRoleCode;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsBoolean()
  passwordMustChange?: boolean;
}
