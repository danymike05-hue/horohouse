import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional, ApiProperty, PartialType } from '@nestjs/swagger';
import { MessageTrigger, TemplateKind } from '../schemas/host-message.schema';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateTemplateDto {
  @ApiProperty({ enum: TemplateKind })
  @IsEnum(TemplateKind)
  kind: TemplateKind;

  @ApiProperty({ maxLength: 60 })
  @IsString() @MinLength(1) @MaxLength(60)
  title: string;

  @ApiProperty({ maxLength: 2000 })
  @IsString() @MinLength(1) @MaxLength(2000)
  body: string;

  @ApiPropertyOptional({ enum: MessageTrigger })
  @IsOptional() @IsEnum(MessageTrigger)
  trigger?: MessageTrigger;

  @ApiPropertyOptional({ minimum: 0, maximum: 14 })
  @IsOptional() @IsInt() @Min(0) @Max(14)
  daysOffset?: number;

  @ApiPropertyOptional({ example: '10:00', description: 'Cameroon time' })
  @IsOptional() @Matches(HHMM, { message: 'sendTime must be HH:mm' })
  sendTime?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(100) @IsMongoId({ each: true })
  propertyIds?: string[];

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}

export class CheckInGuideDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) wifiName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) wifiPassword?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1500) directions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) accessInstructions?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) parking?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) houseManual?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) emergencyPhone?: string;
}

export class GuidePhotoCaptionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) caption?: string;
}
