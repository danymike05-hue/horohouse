import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsObject,
  Min,
  Max,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Sub-DTOs ─────────────────────────────────────────────────────────────────

export class BookingGuestsDto {
  @ApiProperty({ example: 2, description: 'Number of adult guests' })
  @IsNumber()
  @Min(1)
  @Max(20)
  adults: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  children?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  infants?: number;
}

// ─── Create Booking ───────────────────────────────────────────────────────────

export class CreateBookingDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011', description: 'Property ID to book' })
  @IsString()
  @Length(24, 24, { message: 'propertyId must be a valid 24-character ObjectId' })
  propertyId: string;

  @ApiProperty({ example: '2026-04-10', description: 'Check-in date (ISO 8601)' })
  @IsDateString()
  checkIn: string;

  @ApiProperty({ example: '2026-04-15', description: 'Check-out date (ISO 8601)' })
  @IsDateString()
  checkOut: string;

  @ApiProperty({ type: BookingGuestsDto })
  @IsObject()
  @ValidateNested()
  @Type(() => BookingGuestsDto)
  guests: BookingGuestsDto;

  @ApiPropertyOptional({
    example: 'XAF',
    description: 'Currency code (defaults to property currency)',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    example: 'We will arrive around 15:00. Is early check-in possible?',
    description: 'Optional message to the host',
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  guestNote?: string;

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439022',
    description: 'Specific room ID — required for hotels, hostels, motels with multiple rooms',
  })
  @IsOptional()
  @IsString()
  @Length(24, 24, { message: 'roomId must be a valid 24-character ObjectId' })
  roomId?: string;
}

// ─── Cancel Booking ───────────────────────────────────────────────────────────

export class CancelBookingDto {
  @ApiPropertyOptional({
    example: 'Change of travel plans',
    description: 'Reason for cancellation',
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}

// ─── Confirm / Reject Booking (host) ─────────────────────────────────────────

export class RespondToBookingDto {
  @ApiPropertyOptional({
    example: 'Welcome! I will leave the key under the mat.',
    description: 'Optional message to the guest',
  })
  @IsOptional()
  @IsString()
  @Length(0, 1000)
  hostNote?: string;

  /** Only used when rejecting */
  @ApiPropertyOptional({
    example: 'Property is under maintenance those dates.',
    description: 'Reason for rejection (required when rejecting)',
  })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  reason?: string;
}

// ─── Update Payment (admin / webhook) ────────────────────────────────────────

export class UpdatePaymentDto {
  @ApiProperty({ example: 'paid', enum: ['unpaid', 'paid', 'refunded', 'partial'] })
  @IsEnum(['unpaid', 'paid', 'refunded', 'partial'])
  paymentStatus: string;

  @ApiPropertyOptional({ example: 'TXN_ABC123456' })
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @ApiPropertyOptional({ example: 'mobile_money' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

// ─── Query / Filter ───────────────────────────────────────────────────────────

export class BookingQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    enum: ['pending', 'confirmed', 'cancelled', 'completed', 'rejected', 'no_show'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({ example: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}

// ─── Availability query ───────────────────────────────────────────────────────

export class AvailabilityQueryDto {
  @ApiProperty({ example: '2026-04-01', description: 'Start of range to check' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-04-30', description: 'End of range to check' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439022',
    description: 'Optional room ID — returns room-specific availability instead of property-wide',
  })
  @IsOptional()
  @IsString()
  @Length(24, 24)
  roomId?: string;
}
