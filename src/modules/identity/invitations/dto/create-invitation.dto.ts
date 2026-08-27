import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { UserRoleCode } from '@prisma/client';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(UserRoleCode)
  roleCode!: UserRoleCode;
}
