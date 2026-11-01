import {
  IsString, IsOptional, IsEnum, IsBoolean, IsArray,
  IsMongoId, MaxLength, ValidateNested, IsObject, IsDateString, IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PostType } from '../schemas/post.schema';

class CoverImageDto {
  @IsString() url: string;
  @IsString() publicId: string;
  @IsOptional() @IsString() alt?: string;
  @IsOptional() @IsString() caption?: string;
  @IsOptional() @IsNumber() width?: number;
  @IsOptional() @IsNumber() height?: number;
}

class SeoDto {
  @IsOptional() @IsString() @MaxLength(70) metaTitle?: string;
  @IsOptional() @IsString() @MaxLength(160) metaDescription?: string;
  @IsOptional() @IsString() ogImage?: string;
  @IsOptional() @IsString() ogTitle?: string;
  @IsOptional() @IsString() ogDescription?: string;
  @IsOptional() @IsString() canonicalUrl?: string;
  @IsOptional() @IsBoolean() noIndex?: boolean;
}

class NeighborhoodDto {
  @IsString() name: string;
  @IsString() city: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() coordinates?: { lat: number; lng: number };
}

class MarketDataDto {
  @IsOptional() @IsNumber() averagePrice?: number;
  @IsOptional() @IsNumber() priceChange?: number;
  @IsOptional() @IsNumber() demandIndex?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsDateString() dataDate?: string;
  @IsOptional() @IsString() source?: string;
}

class CtaDto {
  @IsString() type: string;
  @IsString() label: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsMongoId() propertyId?: string;
}

export class CreatePostDto {
  @IsString() @MaxLength(160)
  title: string;

  @IsString() @MaxLength(300)
  excerpt: string;

  @IsObject()
  content: Record<string, any>; // Tiptap JSON

  @IsMongoId()
  author: string;

  @IsOptional() @IsArray() @IsMongoId({ each: true })
  coAuthors?: string[];

  @IsMongoId()
  category: string;

  @IsOptional() @IsArray() @IsMongoId({ each: true })
  tags?: string[];

  @IsOptional() @IsEnum(PostType)
  postType?: PostType;

  @IsOptional() @ValidateNested() @Type(() => CoverImageDto)
  coverImage?: CoverImageDto;

  @IsOptional() @ValidateNested() @Type(() => SeoDto)
  seo?: SeoDto;

  @IsOptional() @IsArray() @IsMongoId({ each: true })
  relatedListings?: string[];

  @IsOptional() @ValidateNested() @Type(() => NeighborhoodDto)
  neighborhood?: NeighborhoodDto;

  @IsOptional() @ValidateNested() @Type(() => MarketDataDto)
  marketData?: MarketDataDto;

  @IsOptional() @ValidateNested() @Type(() => CtaDto)
  cta?: CtaDto;

  @IsOptional() @IsBoolean()
  isFeatured?: boolean;

  @IsOptional() @IsBoolean()
  isPinned?: boolean;
}
