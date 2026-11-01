import { IsString, IsNotEmpty, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum WarningSeverity {
  WARNING = 'warning',
  FINAL_WARNING = 'final_warning',
}

export class SendWarningDto {
  @ApiProperty({
    description: 'The custom message to send to the property owner',
    example: 'Your listing has been reported for misleading information. Please review and update it.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({
    description: 'Severity level of the warning',
    enum: WarningSeverity,
    default: WarningSeverity.WARNING,
  })
  @IsOptional()
  @IsEnum(WarningSeverity)
  severity?: WarningSeverity;
}