import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsArray,
  IsDateString,
  IsObject,
  ValidateNested,
  Min,
  Max,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  PropertyType,
  ListingType,
  PropertyStatus,
  PricingUnit,
  CancellationPolicy,
} from '../schemas/property.schema';

// ─── Sub-DTOs ─────────────────────────────────────────────────────────────────

export class ShortTermAmenitiesDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasWifi?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasBreakfast?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasParking?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasTv?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasKitchen?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasKitchenette?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasWasher?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasDryer?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasAirConditioning?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasHeating?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() petsAllowed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() smokingAllowed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() partiesAllowed?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() wheelchairAccessible?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() selfCheckIn?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() airportTransfer?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() conciergeService?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dailyHousekeeping?: boolean;

  @ApiPropertyOptional({ example: 4, description: 'Maximum number of guests allowed' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  maxGuests?: number;

  @ApiPropertyOptional({ example: '14:00', description: 'Check-in time (HH:mm)' })
  @IsOptional()
  @IsString()
  @Length(5, 5)
  checkInTime?: string;

  @ApiPropertyOptional({ example: '11:00', description: 'Check-out time (HH:mm)' })
  @IsOptional()
  @IsString()
  @Length(5, 5)
  checkOutTime?: string;
}

export class UnavailableDateRangeDto {
  @ApiProperty({ example: '2026-04-01', description: 'Block start date (ISO 8601)' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-04-07', description: 'Block end date (ISO 8601)' })
  @IsDateString()
  to: string;

  @ApiPropertyOptional({ example: 'owner_use', description: 'Reason for blocking' })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  reason?: string;
}

// ─── Create Property ──────────────────────────────────────────────────────────

export class CreatePropertyDto {
  // ── Required core fields ──────────────────────────────────────────────────

  @ApiProperty({ example: 'Cozy Studio near Airport' })
  @IsString()
  title: string;

  @ApiProperty({ example: 25000, description: 'Price in base currency (per pricingUnit for short-term)' })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 30000, description: 'Original price before price reduction' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @ApiPropertyOptional({ example: 'XAF' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ enum: PropertyType })
  @IsEnum(PropertyType)
  type: PropertyType;

  @ApiProperty({ enum: ListingType, description: 'Use short_term for hotels, vacation rentals, etc.' })
  @IsEnum(ListingType)
  listingType: ListingType;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty({ example: 'Douala' })
  @IsString()
  city: string;

  @ApiProperty({ example: '123 Rue de la Paix' })
  @IsString()
  address: string;

  @ApiPropertyOptional({ example: 'Littoral' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'Akwa' })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional({ example: 'Cameroon' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 4.0511 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 9.7679 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  // ── Long-term amenities ───────────────────────────────────────────────────

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  amenities?: {
    bedrooms?: number;
    bathrooms?: number;
    parkingSpaces?: number;
    hasGarden?: boolean;
    hasPool?: boolean;
    hasGym?: boolean;
    hasSecurity?: boolean;
    hasElevator?: boolean;
    hasBalcony?: boolean;
    hasAirConditioning?: boolean;
    hasInternet?: boolean;
    hasGenerator?: boolean;
    furnished?: boolean;
  };

  // ── Short-term specific ───────────────────────────────────────────────────

  @ApiPropertyOptional({
    enum: PricingUnit,
    description: 'How the price is charged — required when listingType is short_term',
  })
  @IsOptional()
  @IsEnum(PricingUnit)
  pricingUnit?: PricingUnit;

  @ApiPropertyOptional({ example: 2, description: 'Minimum number of nights per booking' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minNights?: number;

  @ApiPropertyOptional({ example: 14, description: 'Maximum number of nights per booking' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxNights?: number;

  @ApiPropertyOptional({ example: 5000, description: 'One-time cleaning fee added to the booking total' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cleaningFee?: number;

  @ApiPropertyOptional({ example: 2000, description: 'Additional service fee per booking' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceFee?: number;

  @ApiPropertyOptional({ example: 10, description: 'Weekly discount % applied for stays ≥7 nights (0–100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weeklyDiscountPercent?: number;

  @ApiPropertyOptional({ example: 15, description: 'Monthly discount % applied for stays ≥28 nights (0–100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  monthlyDiscountPercent?: number;

  @ApiPropertyOptional({ example: 4, description: 'Minimum number of nights required to qualify for custom stay discount' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  customDiscountNights?: number;

  @ApiPropertyOptional({ example: 5, description: 'Custom discount percentage applied when stay duration reaches customDiscountNights' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  customDiscountPercent?: number;

  @ApiPropertyOptional({ type: ShortTermAmenitiesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ShortTermAmenitiesDto)
  shortTermAmenities?: ShortTermAmenitiesDto;

  @ApiPropertyOptional({
    example: false,
    description: 'If true, bookings are auto-confirmed (Instant Book)',
  })
  @IsOptional()
  @IsBoolean()
  isInstantBookable?: boolean;

  @ApiPropertyOptional({
    enum: CancellationPolicy,
    description: 'Refund policy applied when a guest cancels',
  })
  @IsOptional()
  @IsEnum(CancellationPolicy)
  cancellationPolicy?: CancellationPolicy;

  @ApiPropertyOptional({ example: 1, description: 'Days of advance notice required before check-in' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  advanceNoticeDays?: number;

  @ApiPropertyOptional({ example: 180, description: 'How many days ahead guests can book' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  bookingWindowDays?: number;

  // ── Property details ──────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @IsNumber()
  area?: number;

  @ApiPropertyOptional({ example: 2020 })
  @IsOptional()
  @IsNumber()
  yearBuilt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  floorNumber?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  totalFloors?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  pricePerSqm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  maintenanceFee?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ description: 'WhatsApp number (primary contact channel in Cameroon)' })
  @IsOptional()
  @IsString()
  contactWhatsApp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nearbyAmenities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  transportAccess?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  virtualTourUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({
    enum: ['kuula', 'youtube', 'images', 'none'],
    description: 'Which tour renderer to use',
  })
  @IsOptional()
  @IsEnum(['kuula', 'youtube', 'images', 'none'])
  tourType?: string;

  @ApiPropertyOptional({ description: 'Cloudinary URL for tour preview thumbnail' })
  @IsOptional()
  @IsString()
  tourThumbnail?: string;

  @ApiPropertyOptional({ example: 4, description: 'Star rating (hotels only): 1–5' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  starRating?: number;

  @ApiPropertyOptional({ enum: PropertyStatus })
  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  images?: any[];

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  videos?: any[];
}

// ─── Update Property ──────────────────────────────────────────────────────────

export class UpdatePropertyDto extends PartialType(CreatePropertyDto) {
  @ApiPropertyOptional({ enum: PropertyStatus })
  @IsOptional()
  @IsEnum(PropertyStatus)
  availability?: PropertyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Block / Unblock dates ────────────────────────────────────────────────────

export class BlockDatesDto {
  @ApiProperty({ type: [UnavailableDateRangeDto], description: 'Date ranges to block' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UnavailableDateRangeDto)
  ranges: UnavailableDateRangeDto[];
}

export class UnblockDatesDto {
  @ApiProperty({
    example: ['2026-04-01', '2026-04-07'],
    description: 'Block start dates to remove (identifies the range to remove)',
  })
  @IsArray()
  @IsDateString({}, { each: true })
  fromDates: string[];
}

// ─── Host Calendar Settings & Sync ──────────────────────────────────────────

export class UpdateCalendarSettingsDto {
  @ApiPropertyOptional({ example: 50000, description: 'Base price per night in XAF' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @ApiPropertyOptional({ example: 60000, description: 'Weekend price per night (null = same as base)' })
  @IsOptional()
  weekendPrice?: number | null;

  @ApiPropertyOptional({ example: 2, description: 'Minimum nights stay' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  minNights?: number;

  @ApiPropertyOptional({ example: 30, description: 'Maximum nights stay (null = no limit)' })
  @IsOptional()
  maxNights?: number | null;

  @ApiPropertyOptional({ example: 0, description: 'Advance notice in days before check-in' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  noticeDays?: number;

  @ApiPropertyOptional({ example: 12, description: 'How far ahead guests can book in months (null = no limit)' })
  @IsOptional()
  windowMonths?: number | null;
}

export class SetCalendarPricesDto {
  @ApiProperty({ example: '2026-05-01', description: 'Range start (YYYY-MM-DD)' })
  @IsString()
  from: string;

  @ApiProperty({ example: '2026-05-05', description: 'Range end (YYYY-MM-DD)' })
  @IsString()
  to: string;

  @ApiPropertyOptional({ example: 45000, description: 'Override price per night (null to remove override)' })
  @IsOptional()
  price?: number | null;
}

export class AddExternalCalendarDto {
  @ApiProperty({ example: 'Airbnb', description: 'Calendar feed name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'https://airbnb.com/calendar/ical/...', description: 'iCal URL' })
  @IsString()
  url: string;
}