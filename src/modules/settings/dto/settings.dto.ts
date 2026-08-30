import { IsOptional, IsString, IsObject, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSettingDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  key!: string;

  @ApiProperty()
  @IsString()
  value!: string;
}

export class BulkUpdateSettingsDto {
  @ApiProperty({ type: Object, additionalProperties: { type: 'string' } })
  @IsObject()
  settings!: Record<string, string>;
}
