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
import { MoMoProvider } from '../schemas/split-payment.schema';

// ─── Tenant share input ───────────────────────────────────────────────────────

export class TenantShareInputDto {
  @ApiProperty({ example: '64abc123...', description: 'Tenant User ID' })
  @IsMongoId()
  tenantUserId: string;

  @ApiProperty({ example: 'Jean Dupont' })
  @IsString()
  @Length(2, 100)
  tenantName: string;

  @ApiPropertyOptional({ example: '+237612345678' })
  @IsOptional()
  @IsString()
  tenantPhone?: string;

  @ApiProperty({ example: 50000, description: 'Amount this tenant owes in XAF' })
  @IsNumber()
  @Min(0)
  amountDue: number;

  @ApiPropertyOptional({ example: '+237612345678', description: 'MoMo phone to send payment request to' })
  @IsOptional()
  @IsString()
  momoPhone?: string;

  @ApiPropertyOptional({ enum: MoMoProvider })
  @IsOptional()
  @IsEnum(MoMoProvider)
  momoProvider?: MoMoProvider;

  @ApiProperty({ example: '2025-09-05', description: 'Due date for this tenant share' })
  @IsDateString()
  dueDate: string;
}

// ─── Create a split payment ledger for a billing cycle ───────────────────────

export class CreateSplitPaymentDto {
  @ApiProperty({ example: '64abc123...' })
  @IsMongoId()
  propertyId: string;

  @ApiProperty({ example: '64abc123...', description: 'DigitalLease ID this cycle belongs to' })
  @IsMongoId()
  leaseId: string;

  @ApiProperty({ example: 'September 2025' })
  @IsString()
  @Length(3, 50)
  cycleLabel: string;

  @ApiProperty({ example: '2025-09-01' })
  @IsDateString()
  cycleStart: string;

  @ApiProperty({ example: '2025-09-30' })
  @IsDateString()
  cycleEnd: string;

  @ApiProperty({ example: 100000, description: 'Total monthly rent for the property in XAF' })
  @IsNumber()
  @Min(0)
  totalRent: number;

  @ApiProperty({ type: [TenantShareInputDto], description: 'One entry per tenant — amounts must sum to totalRent' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TenantShareInputDto)
  tenantShares: TenantShareInputDto[];
}

// ─── Record a tenant payment (called by Flutterwave webhook or manually) ─────

export class RecordTenantPaymentDto {
  @ApiProperty({ example: '64abc123...', description: 'Tenant User ID who paid' })
  @IsMongoId()
  tenantUserId: string;

  @ApiProperty({ example: 50000, description: 'Amount paid in XAF' })
  @IsNumber()
  @Min(1)
  amountPaid: number;

  @ApiPropertyOptional({ example: 'TXN-MTN-2025090112345', description: 'MoMo transaction reference from Flutterwave' })
  @IsOptional()
  @IsString()
  momoTransactionId?: string;

  @ApiPropertyOptional({ enum: MoMoProvider })
  @IsOptional()
  @IsEnum(MoMoProvider)
  momoProvider?: MoMoProvider;
}

// ─── Initiate a MoMo charge request to a tenant ──────────────────────────────

export class InitiateTenantChargeDto {
  @ApiProperty({ example: '64abc123...', description: 'Tenant User ID to charge' })
  @IsMongoId()
  tenantUserId: string;

  @ApiProperty({ example: '+237612345678', description: 'MoMo phone number to debit' })
  @IsString()
  momoPhone: string;

  @ApiProperty({ enum: MoMoProvider })
  @IsEnum(MoMoProvider)
  momoProvider: MoMoProvider;
}

// ─── Stateless rent split calculator ─────────────────────────────────────────

export class SplitRentCalculatorDto {
  @ApiProperty({ example: 100000, description: 'Total monthly rent in XAF' })
  @IsNumber()
  @Min(1)
  totalRent: number;

  @ApiProperty({ example: 3, description: 'Number of tenants splitting the rent' })
  @IsNumber()
  @Min(1)
  numberOfTenants: number;

  @ApiPropertyOptional({
    example: [60, 40],
    description: 'Optional custom split percentages per tenant (must sum to 100). Omit for equal split.',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(99, { each: true })
  customPercentages?: number[];
}