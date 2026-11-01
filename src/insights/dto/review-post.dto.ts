import { IsEnum, IsOptional, IsString } from "class-validator";

export class ReviewPostDto {
  @IsEnum(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @IsOptional() @IsString()
  note?: string;
}