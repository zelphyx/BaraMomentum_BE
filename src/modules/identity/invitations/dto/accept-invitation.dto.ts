import { IsString, MinLength } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(12)
  password!: string;
}
