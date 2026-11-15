import { Type, Transform } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString,
  IsUrl, Length, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { PROVIDER_TYPES, SCHOLARSHIP_LEVELS } from '../schemas/scholarship.schema';

const toBool = ({ value }: { value: unknown }) => (value === true || value === 'true' ? true : value === false || value === 'false' ? false : undefined);

export class CoverageDto {
  @IsOptional() @IsBoolean() fullyFunded?: boolean;
  @IsOptional() @IsBoolean() tuition?: boolean;
  @IsOptional() @IsBoolean() housing?: boolean;
  @IsOptional() @IsBoolean() allowance?: boolean;
  @IsOptional() @IsBoolean() flights?: boolean;
  @IsOptional() @IsString() @MaxLength(120) amountText?: string;
}

export class CreateScholarshipDto {
  @IsString() @Length(3, 160) title: string;
  @IsString() @Length(2, 120) provider: string;
  @IsOptional() @IsIn(PROVIDER_TYPES as unknown as string[]) providerType?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;

  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsIn(SCHOLARSHIP_LEVELS as unknown as string[], { each: true }) levels?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) fields?: string[];

  @IsString() @Length(2, 60) destinationCountry: string;
  @IsOptional() @IsString() @MaxLength(60) destinationCity?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(60) @IsString({ each: true }) @MaxLength(60, { each: true }) eligibleNationalities?: string[];

  @IsOptional() @ValidateNested() @Type(() => CoverageDto) coverage?: CoverageDto;

  @IsOptional() @IsDateString() deadline?: string;
  @IsOptional() @IsString() @MaxLength(40) language?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(200, { each: true }) requirements?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(200, { each: true }) documents?: string[];

  /** Only https links to official pages */
  @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) applyUrl: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) sourceUrl?: string;

  @IsOptional() @IsBoolean() isPublished?: boolean;
}

export class UpdateScholarshipDto {
  @IsOptional() @IsString() @Length(3, 160) title?: string;
  @IsOptional() @IsString() @Length(2, 120) provider?: string;
  @IsOptional() @IsIn(PROVIDER_TYPES as unknown as string[]) providerType?: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(4) @IsIn(SCHOLARSHIP_LEVELS as unknown as string[], { each: true }) levels?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(60, { each: true }) fields?: string[];
  @IsOptional() @IsString() @Length(2, 60) destinationCountry?: string;
  @IsOptional() @IsString() @MaxLength(60) destinationCity?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(60) @IsString({ each: true }) @MaxLength(60, { each: true }) eligibleNationalities?: string[];
  @IsOptional() @ValidateNested() @Type(() => CoverageDto) coverage?: CoverageDto;
  /** null clears the deadline (open all year) */
  @IsOptional() @IsDateString() deadline?: string | null;
  @IsOptional() @IsString() @MaxLength(40) language?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(200, { each: true }) requirements?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(200, { each: true }) documents?: string[];
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) applyUrl?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(500) sourceUrl?: string;
  @IsOptional() @IsBoolean() isPublished?: boolean;
  /** Mark the details as just checked against the source */
  @IsOptional() @IsBoolean() markChecked?: boolean;
}

export class ScholarshipQueryDto {
  @IsOptional() @IsIn(SCHOLARSHIP_LEVELS as unknown as string[]) level?: string;
  @IsOptional() @IsString() @MaxLength(60) field?: string;
  @IsOptional() @IsString() @MaxLength(60) country?: string;
  @IsOptional() @Transform(toBool) @IsBoolean() fullyFunded?: boolean;
  /** Deadline within this many days */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(366) withinDays?: number;
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  /** Sort by fit with the student's profile (level, faculty) */
  @IsOptional() @Transform(toBool) @IsBoolean() matched?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
