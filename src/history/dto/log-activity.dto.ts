import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { 
  IsEnum, 
  IsOptional, 
  IsString, 
  IsNumber, 
  IsObject, 
  IsArray,
  IsBoolean,
  ValidateNested,
  IsMongoId 
} from 'class-validator';
import { Type } from 'class-transformer';
import { Types } from 'mongoose';
import { ActivityType, SearchFilters, DeviceInfo } from '../schemas/history.schema';

class LocationDto {
  @ApiProperty({ example: 'Point' })
  @IsString()
  type: 'Point';

  @ApiProperty({ example: [11.5021, 3.8480], description: '[longitude, latitude]' })
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates: [number, number];
}

export class LogActivityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  userId?: Types.ObjectId;

  @ApiProperty({ enum: ActivityType })
  @IsEnum(ActivityType)
  activityType: ActivityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  propertyId?: Types.ObjectId;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  agentId?: Types.ObjectId;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  searchQuery?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  searchFilters?: SearchFilters;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  resultsCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  resultsClicked?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  userLocation?: LocationDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  searchLocation?: LocationDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  deviceInfo?: DeviceInfo;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referrer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  viewDuration?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  viewedImages?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  scrollDepth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  contactedAgent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inquiryMessage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inquiryPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inquiryEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  anonymousId?: string;
}