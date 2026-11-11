// chat.dto.ts - Request DTOs with validation

import { IsString, IsNotEmpty, IsOptional, IsArray, IsObject, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ChatMessageDto {
  @ApiProperty({
    description: 'User message text',
    example: 'Je cherche un appartement 3 chambres à Douala',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Message is required and cannot be empty' })
  @MinLength(1, { message: 'Message must not be empty' })
  @MaxLength(1000, { message: 'Message is too long (max 1000 characters)' })
  message: string;

  @ApiPropertyOptional({
    description: 'User ID (automatically populated for authenticated users)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Session ID for conversation tracking',
    example: 'session-123',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiPropertyOptional({
    description: 'Previous conversation messages for context',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  conversationHistory?: any[];

  @ApiPropertyOptional({
    description: 'Current active search filters',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  currentFilters?: any;
}

export class RefineSearchDto {
  @ApiProperty({
    description: 'Refinement message',
    example: 'with swimming pool',
    minLength: 1,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'Refinement message is required' })
  @MinLength(1, { message: 'Message must not be empty' })
  @MaxLength(500, { message: 'Message is too long (max 500 characters)' })
  message: string;

  @ApiProperty({
    description: 'Current search filters to refine',
    example: { city: 'Douala', propertyType: 'villa' },
  })
  @IsObject()
  @IsNotEmpty({ message: 'Current filters are required' })
  currentFilters: any;

  @ApiPropertyOptional({
    description: 'Previous conversation messages',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  conversationHistory?: any[];
}