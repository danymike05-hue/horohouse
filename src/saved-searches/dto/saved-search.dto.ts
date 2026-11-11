import { IsString, IsOptional, IsNumber, IsEnum, IsBoolean, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { SearchFrequency } from '../schemas/saved-search.schema';

export class SearchCriteriaDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @IsString()
  listingType?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bedrooms?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bathrooms?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  radius?: number;
}

export class CreateSavedSearchDto {
  @IsString()
  name: string;

  @ValidateNested()
  @Type(() => SearchCriteriaDto)
  searchCriteria: SearchCriteriaDto;

  @IsOptional()
  @IsEnum(SearchFrequency)
  notificationFrequency?: SearchFrequency;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSavedSearchDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SearchCriteriaDto)
  searchCriteria?: SearchCriteriaDto;

  @IsOptional()
  @IsEnum(SearchFrequency)
  notificationFrequency?: SearchFrequency;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}