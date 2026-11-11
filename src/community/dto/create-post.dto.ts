import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsBoolean,
  MinLength,
  MaxLength,
  IsMongoId,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PostCategory } from '../schemas/community-post.schema';

export class CreatePostDto {
  @ApiProperty({ enum: PostCategory })
  @IsEnum(PostCategory)
  category: PostCategory;

  @ApiProperty({ example: 'How I went from 0 to 40 reviews in 6 months' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'A short preview of the post' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  excerpt?: string;

  @ApiPropertyOptional({ description: 'Full post body in markdown' })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ type: [String], example: ['Tips', 'New Host'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'ID of the parent post (for replies)' })
  @IsOptional()
  @IsMongoId()
  replyToId?: string;

  @ApiPropertyOptional({ description: 'Top-level post ID, passed when replying to a reply' })
  @IsOptional()
  @IsMongoId()
  rootPostId?: string;
}
