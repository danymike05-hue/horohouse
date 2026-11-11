import { Type } from "class-transformer";
import { IsOptional, IsString, IsEnum, IsNumber } from "class-validator";
import { PostType } from "../schemas/post.schema";

export class QueryPostsDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() tag?: string;
  @IsOptional() @IsEnum(PostType) postType?: PostType;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() author?: string;
  @IsOptional() @IsString() q?: string; // search query
  @IsOptional() @IsString() status?: string; // admin only
  @IsOptional() @IsNumber() @Type(() => Number) page?: number = 1;
  @IsOptional() @IsNumber() @Type(() => Number) limit?: number = 12;
  @IsOptional() @IsString() sortBy?: string = 'publishedAt';
  @IsOptional() @IsString() sortOrder?: 'asc' | 'desc' = 'desc';
}