import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRoleCode, UserStatus } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(UserRoleCode)
  roleCode!: UserRoleCode;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
