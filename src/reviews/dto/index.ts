import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsMongoId,
  IsArray,
  IsObject,
  ValidateNested,
  Min,
  Max,
  MinLength,
  MaxLength,
  Length,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewType, ReviewerRole } from '../schemas/review.schema';

// ─── Sub-rating DTOs ──────────────────────────────────────────────────────────

export class StaySubRatingsDto {
  @ApiPropertyOptional({ example: 5, description: 'Cleanliness of the property (1–5)' })
  @IsOptional() @IsNumber() @Min(1) @Max(5)
  cleanliness?: number;

  @ApiPropertyOptional({ example: 4, description: 'Did the listing match the description? (1–5)' })
  @IsOptional() @IsNumber() @Min(1) @Max(5)
  accuracy?: number;

  @ApiPropertyOptional({ example: 5, description: 'Smoothness of check-in (1–5)' })
  @IsOptional() @IsNumber() @Min(1) @Max(5)
  checkIn?: number;

  @ApiPropertyOptional({ example: 5, description: 'Host communication (1–5)' })
  @IsOptional() @IsNumber() @Min(1) @Max(5)
  communication?: number;

  @ApiPropertyOptional({ example: 4, description: 'Neighbourhood / location (1–5)' })
  @IsOptional() @IsNumber() @Min(1) @Max(5)
  location?: number;

  @ApiPropertyOptional({ example: 4, description: 'Value for money (1–5)' })
  @IsOptional() @IsNumber() @Min(1) @Max(5)
  value?: number;
}

export class GuestSubRatingsDto {
  @ApiPropertyOptional({ example: 5, description: 'Did the guest leave the place clean? (1–5)' })
  @IsOptional() @IsNumber() @Min(1) @Max(5)
  cleanliness?: number;

  @ApiPropertyOptional({ example: 5, description: 'Was the guest easy to communicate with? (1–5)' })
  @IsOptional() @IsNumber() @Min(1) @Max(5)
  communication?: number;

  @ApiPropertyOptional({ example: 5, description: 'Did they respect house rules? (1–5)' })
  @IsOptional() @IsNumber() @Min(1) @Max(5)
  rulesFollowed?: number;

  @ApiPropertyOptional({ example: true, description: 'Would you host this guest again?' })
  @IsOptional() @IsBoolean()
  wouldHostAgain?: boolean;
}

// ─── Create Review ────────────────────────────────────────────────────────────

export class CreateReviewDto {
  @ApiProperty({
    enum: ReviewType,
    description:
      'property | agent — existing types. ' +
      'stay — guest reviews the property after a completed booking. ' +
      'guest — host reviews the guest after a completed booking.',
  })
  @IsEnum(ReviewType)
  reviewType: ReviewType;

  // ── Existing targets ──────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Required for reviewType = property' })
  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @ApiPropertyOptional({ description: 'Required for reviewType = agent' })
  @IsOptional()
  @IsMongoId()
  agentId?: string;

  // ── New targets ───────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    description:
      'Required for reviewType = stay or guest. ' +
      'Must reference a COMPLETED booking where the caller is the guest (stay) or host (guest).',
  })
  @IsOptional()
  @IsMongoId()
  bookingId?: string;

  @ApiPropertyOptional({ description: 'Required for reviewType = insight' })
  @IsOptional()
  @IsMongoId()
  insightId?: string;

  // ── Ratings ───────────────────────────────────────────────────────────────

  @ApiProperty({ example: 5, description: 'Overall rating 1–5' })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiPropertyOptional({
    type: StaySubRatingsDto,
    description: 'Granular sub-ratings — only for reviewType = stay',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StaySubRatingsDto)
  staySubRatings?: StaySubRatingsDto;

  @ApiPropertyOptional({
    type: GuestSubRatingsDto,
    description: 'Sub-ratings for the guest — only for reviewType = guest',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => GuestSubRatingsDto)
  guestSubRatings?: GuestSubRatingsDto;

  // ── Content ───────────────────────────────────────────────────────────────

  // FIXED: @IsOptional() added + ApiPropertyOptional + comment? (was required,
  // causing 400 whenever the user skipped the comment step and sent undefined)
  @ApiPropertyOptional({ example: 'Wonderful place, very clean and exactly as described.' })
  @IsOptional()
  @IsString()
  @MinLength(10, { message: 'Review must be at least 10 characters' })
  @MaxLength(1000, { message: 'Review must not exceed 1000 characters' })
  comment?: string;

  @ApiPropertyOptional({ type: [String], description: 'Optional photo URLs' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

// ─── Update Review ────────────────────────────────────────────────────────────

export class UpdateReviewDto {
  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional({ type: StaySubRatingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => StaySubRatingsDto)
  staySubRatings?: StaySubRatingsDto;

  @ApiPropertyOptional({ type: GuestSubRatingsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => GuestSubRatingsDto)
  guestSubRatings?: GuestSubRatingsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  comment?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

// ─── Respond to Review ────────────────────────────────────────────────────────

export class RespondReviewDto {
  @ApiProperty({ example: 'Thank you for staying with us! We hope to see you again.' })
  @IsString()
  @MinLength(10, { message: 'Response must be at least 10 characters' })
  @MaxLength(500, { message: 'Response must not exceed 500 characters' })
  response: string;
}

// ─── Export barrel ────────────────────────────────────────────────────────────

export { CreateReviewDto as default };