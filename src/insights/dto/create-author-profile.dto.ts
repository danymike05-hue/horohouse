import { IsMongoId, IsString, IsOptional, IsArray, IsBoolean } from "class-validator";

export class CreateAuthorProfileDto {
  @IsMongoId() userId: string;
  @IsString() displayName: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) specialties?: string[];
  @IsOptional() social?: { twitter?: string; linkedin?: string; website?: string };
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() avatar?: string;
}