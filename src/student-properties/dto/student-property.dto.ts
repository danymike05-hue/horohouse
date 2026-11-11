import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  WaterSource,
  ElectricityBackup,
  FurnishingStatus,
  GenderRestriction,
} from '../../properties/schemas/property.schema';

// ─── Student property search filters ─────────────────────────────────────────

export class StudentPropertySearchDto {
  // ── Pagination ────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['createdAt', 'price', 'campusProximityMeters', 'pricePerPersonMonthly'], example: 'campusProximityMeters' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'campusProximityMeters';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], example: 'asc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';

  // ── Location ──────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'Buea', description: 'Filter by city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Molyko', description: 'Filter by neighborhood' })
  @IsOptional()
  @IsString()
  neighborhood?: string;

  @ApiPropertyOptional({ example: 'University of Buea', description: 'Filter by nearest campus name' })
  @IsOptional()
  @IsString()
  nearestCampus?: string;

  @ApiPropertyOptional({ example: 2000, description: 'Max walking distance to campus in metres' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxCampusProximityMeters?: number;

  // ── Budget (per-person, not total) ────────────────────────────────────────

  @ApiPropertyOptional({ example: 20000, description: 'Min price per person per month in XAF' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPricePerPerson?: number;

  @ApiPropertyOptional({ example: 60000, description: 'Max price per person per month in XAF' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPricePerPerson?: number;

  // ── Infrastructure ────────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: WaterSource })
  @IsOptional()
  @IsEnum(WaterSource)
  waterSource?: WaterSource;

  @ApiPropertyOptional({ enum: ElectricityBackup })
  @IsOptional()
  @IsEnum(ElectricityBackup)
  electricityBackup?: ElectricityBackup;

  // ── Furnishing ────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: FurnishingStatus })
  @IsOptional()
  @IsEnum(FurnishingStatus)
  furnishingStatus?: FurnishingStatus;

  // ── House rules ───────────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: GenderRestriction, example: 'none' })
  @IsOptional()
  @IsEnum(GenderRestriction)
  genderRestriction?: GenderRestriction;

  @ApiPropertyOptional({ example: false, description: 'Only show properties with no curfew' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  noCurfew?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Only show properties where visitors are allowed' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  visitorsAllowed?: boolean;

  // ── Security ──────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: true, description: 'Only show gated compounds' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasGatedCompound?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Only show properties with a night watchman' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasNightWatchman?: boolean;

  // ── Landlord trust ────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: true, description: 'Only show Student-Approved landlord listings' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  studentApprovedOnly?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Only show landlords who accept the rent-advance scheme' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  acceptsRentAdvanceScheme?: boolean;

  @ApiPropertyOptional({ example: 6, description: 'Max advance months the landlord accepts' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  maxAdvanceMonths?: number;

  // ── Colocation ────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: true, description: 'Only show properties with available beds for colocation' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasAvailableBeds?: boolean;

  @ApiPropertyOptional({ example: 2, description: 'Minimum available beds' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minAvailableBeds?: number;
}

// ─── Mark a property as student-friendly ─────────────────────────────────────

export class MarkStudentFriendlyDto {
  @ApiPropertyOptional({ example: 2000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  campusProximityMeters?: number;

  @ApiPropertyOptional({ example: 'University of Buea' })
  @IsOptional()
  @IsString()
  nearestCampus?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  walkingMinutes?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxiMinutes?: number;

  @ApiPropertyOptional({ enum: WaterSource })
  @IsOptional()
  @IsEnum(WaterSource)
  waterSource?: WaterSource;

  @ApiPropertyOptional({ enum: ElectricityBackup })
  @IsOptional()
  @IsEnum(ElectricityBackup)
  electricityBackup?: ElectricityBackup;

  @ApiPropertyOptional({ enum: FurnishingStatus })
  @IsOptional()
  @IsEnum(FurnishingStatus)
  furnishingStatus?: FurnishingStatus;

  @ApiPropertyOptional({ enum: GenderRestriction })
  @IsOptional()
  @IsEnum(GenderRestriction)
  genderRestriction?: GenderRestriction;

  @ApiPropertyOptional({ example: '22:00' })
  @IsOptional()
  @IsString()
  curfewTime?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  visitorsAllowed?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  cookingAllowed?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hasGatedCompound?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hasNightWatchman?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  hasFence?: boolean;

  @ApiPropertyOptional({ example: 6, description: 'Max advance months the landlord accepts (1–12)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  maxAdvanceMonths?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  acceptsRentAdvanceScheme?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  availableBeds?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  totalBeds?: number;

  @ApiPropertyOptional({ example: 35000, description: 'Price per person per month in XAF' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerPersonMonthly?: number;
}