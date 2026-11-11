import {
  IsString,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsDateString,
  IsMongoId,
  Min,
  Max,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  SleepSchedule,
  CleanlinessLevel,
  SocialHabit,
  StudyHabit,
  RoommateMode,
} from '../schemas/roommate-profile.schema';

// ─── Create roommate profile ──────────────────────────────────────────────────

export class CreateRoommateProfileDto {
  @ApiProperty({ enum: RoommateMode, description: 'have_room = spare bed available; need_room = looking for a place' })
  @IsEnum(RoommateMode)
  mode: RoommateMode;

  @ApiPropertyOptional({ example: '64abc123...', description: 'Required when mode is have_room — your property listing ID' })
  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @ApiProperty({ example: 'Buea' })
  @IsString()
  @Length(2, 50)
  campusCity: string;

  @ApiPropertyOptional({ example: 'Molyko' })
  @IsOptional()
  @IsString()
  @Length(2, 80)
  preferredNeighborhood?: string;

  @ApiProperty({ example: 45000, description: 'Max budget per person per month in XAF' })
  @IsNumber()
  @Min(0)
  budgetPerPersonMax: number;

  @ApiPropertyOptional({ example: 20000, description: 'Min budget per person (optional floor)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetPerPersonMin?: number;

  @ApiProperty({ example: '2025-09-01', description: 'Target move-in date (ISO 8601)' })
  @IsDateString()
  moveInDate: string;

  @ApiPropertyOptional({ example: 14, description: 'Flexibility in days around the move-in date' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  moveInFlexibilityDays?: number;

  @ApiProperty({ enum: SleepSchedule })
  @IsEnum(SleepSchedule)
  sleepSchedule: SleepSchedule;

  @ApiProperty({ enum: CleanlinessLevel })
  @IsEnum(CleanlinessLevel)
  cleanlinessLevel: CleanlinessLevel;

  @ApiProperty({ enum: SocialHabit })
  @IsEnum(SocialHabit)
  socialHabit: SocialHabit;

  @ApiProperty({ enum: StudyHabit })
  @IsEnum(StudyHabit)
  studyHabit: StudyHabit;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isSmoker?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  acceptsSmoker?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  hasPet?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  acceptsPet?: boolean;

  @ApiPropertyOptional({ enum: ['male', 'female', 'any'], example: 'any' })
  @IsOptional()
  @IsEnum(['male', 'female', 'any'])
  preferredRoommateGender?: 'male' | 'female' | 'any';

  @ApiPropertyOptional({ example: 'L3 CS student. I study late but keep the place tidy.', maxLength: 300 })
  @IsOptional()
  @IsString()
  @Length(0, 300)
  bio?: string;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export class UpdateRoommateProfileDto extends PartialType(CreateRoommateProfileDto) {}

// ─── Search / browse ──────────────────────────────────────────────────────────

export class SearchRoommatesDto {
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

  @ApiPropertyOptional({ example: 'Buea', description: 'Filter by campus city' })
  @IsOptional()
  @IsString()
  campusCity?: string;

  @ApiPropertyOptional({ enum: RoommateMode })
  @IsOptional()
  @IsEnum(RoommateMode)
  mode?: RoommateMode;

  @ApiPropertyOptional({ example: 50000, description: 'Max budget per person filter' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxBudget?: number;

  @ApiPropertyOptional({ enum: SleepSchedule })
  @IsOptional()
  @IsEnum(SleepSchedule)
  sleepSchedule?: SleepSchedule;

  @ApiPropertyOptional({ enum: CleanlinessLevel })
  @IsOptional()
  @IsEnum(CleanlinessLevel)
  cleanlinessLevel?: CleanlinessLevel;

  @ApiPropertyOptional({ enum: ['male', 'female', 'any'] })
  @IsOptional()
  @IsEnum(['male', 'female', 'any'])
  preferredRoommateGender?: 'male' | 'female' | 'any';

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  acceptsSmoker?: boolean;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  acceptsPet?: boolean;
}