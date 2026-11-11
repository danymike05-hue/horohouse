import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  IsDateString,
  IsMongoId,
  ValidateNested,
  Min,
  Max,
  Length,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConditionRating } from '../schemas/digital-lease.schema';

// ─── Tenant input ─────────────────────────────────────────────────────────────

export class LeaseTenantInputDto {
  @ApiProperty({ example: '64abc123...' })
  @IsMongoId()
  tenantUserId: string;

  @ApiProperty({ example: 'Jean Dupont' })
  @IsString()
  @Length(2, 100)
  tenantName: string;

  @ApiPropertyOptional({ example: 'jean@example.com' })
  @IsOptional()
  @IsString()
  tenantEmail?: string;

  @ApiPropertyOptional({ example: '+237612345678' })
  @IsOptional()
  @IsString()
  tenantPhone?: string;

  @ApiProperty({ example: 50000, description: "This tenant's share of monthly rent in XAF" })
  @IsNumber()
  @Min(0)
  rentShare: number;
}

// ─── Create lease ─────────────────────────────────────────────────────────────

export class CreateDigitalLeaseDto {
  @ApiProperty({ example: '64abc123...' })
  @IsMongoId()
  propertyId: string;

  @ApiProperty({ type: [LeaseTenantInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LeaseTenantInputDto)
  tenants: LeaseTenantInputDto[];

  @ApiProperty({ example: '2025-10-01' })
  @IsDateString()
  leaseStart: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsDateString()
  leaseEnd: string;

  @ApiProperty({ example: 100000 })
  @IsNumber()
  @Min(0)
  monthlyRent: number;

  @ApiPropertyOptional({ example: 200000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @ApiPropertyOptional({ example: 3, description: 'Months paid in advance (1–12)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  advanceMonths?: number;

  @ApiPropertyOptional({
    type: [Object],
    description: 'Additional clauses beyond the standard template',
    example: [{ heading: 'Pets', body: 'No pets allowed on the premises.' }],
  })
  @IsOptional()
  @IsArray()
  customClauses?: Array<{ heading: string; body: string }>;
}

// ─── Sign a lease ─────────────────────────────────────────────────────────────

export class SignLeaseDto {
  @ApiProperty({
    example: 'data:image/png;base64,iVBORw...',
    description: 'Base64-encoded PNG of the signature drawn in the browser',
  })
  @IsString()
  @Length(10, 100000)
  signatureBase64: string;
}

// ─── Condition log item ───────────────────────────────────────────────────────

export class ConditionItemDto {
  @ApiProperty({ example: 'Front door' })
  @IsString()
  @Length(2, 100)
  label: string;

  @ApiProperty({ enum: ConditionRating })
  @IsEnum(ConditionRating)
  rating: ConditionRating;

  @ApiPropertyOptional({ example: 'Small scratch on lower panel' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  notes?: string;
}

// ─── Add condition log ────────────────────────────────────────────────────────

export class AddConditionLogDto {
  @ApiProperty({ enum: ['move_in', 'move_out'] })
  @IsEnum(['move_in', 'move_out'])
  type: 'move_in' | 'move_out';

  @ApiProperty({ type: [ConditionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ConditionItemDto)
  items: ConditionItemDto[];

  @ApiPropertyOptional({ example: 'Property in generally good condition.' })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  overallNotes?: string;
}

// ─── Terminate lease ──────────────────────────────────────────────────────────

export class TerminateLeaseDto {
  @ApiProperty({ example: 'Tenant vacated early by mutual agreement.' })
  @IsString()
  @Length(5, 500)
  reason: string;
}