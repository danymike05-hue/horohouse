import { IsString, IsOptional, IsNumber } from "class-validator";

export class CreateCategoryDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() coverImage?: string;
  @IsOptional() @IsString() accentColor?: string;
  @IsOptional() @IsString() metaTitle?: string;
  @IsOptional() @IsString() metaDescription?: string;
  @IsOptional() @IsNumber() sortOrder?: number;
}