import { 
  IsString, 
  IsEnum, 
  IsOptional, 
  IsArray, 
  IsMongoId, 
  IsNumber,
  Min,
  Max,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MessageType } from '../schemas/message.schema';

// Create Conversation DTO
export class CreateConversationDto {
  @ApiProperty({ 
    example: '507f1f77bcf86cd799439011',
    description: 'ID of the other participant' 
  })
  @IsMongoId()
  participantId: string;

  @ApiPropertyOptional({ 
    example: '507f1f77bcf86cd799439012',
    description: 'Property ID if conversation is about a property' 
  })
  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @ApiPropertyOptional({ 
    example: 'Hi, I am interested in this property',
    description: 'Initial message content' 
  })
  @IsOptional()
  @IsString()
  initialMessage?: string;
}

// Send Message DTO
export class SendMessageDto {
  @ApiProperty({ 
    example: '507f1f77bcf86cd799439011',
    description: 'Conversation ID' 
  })
  @IsMongoId()
  conversationId: string;

  @ApiPropertyOptional({ 
    example: 'Hello, is this property still available?',
    description: 'Message content' 
  })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ 
    enum: MessageType,
    example: MessageType.TEXT,
    description: 'Type of message' 
  })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({ 
    example: '507f1f77bcf86cd799439012',
    description: 'Property ID if sharing a property' 
  })
  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @ApiPropertyOptional({ 
    example: '507f1f77bcf86cd799439013',
    description: 'Message ID to reply to' 
  })
  @IsOptional()
  @IsMongoId()
  replyTo?: string;
}

// Edit Message DTO
export class EditMessageDto {
  @ApiProperty({ 
    example: 'Updated message content',
    description: 'New message content' 
  })
  @IsString()
  content: string;
}

// Get Messages Query DTO
export class GetMessagesQueryDto {
  @ApiPropertyOptional({ 
    example: 1,
    description: 'Page number' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ 
    example: 50,
    description: 'Messages per page' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @ApiPropertyOptional({ 
    example: '507f1f77bcf86cd799439011',
    description: 'Get messages before this message ID (for pagination)' 
  })
  @IsOptional()
  @IsMongoId()
  before?: string;
}

// Get Conversations Query DTO
export class GetConversationsQueryDto {
  @ApiPropertyOptional({ 
    example: 1,
    description: 'Page number' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ 
    example: 20,
    description: 'Conversations per page' 
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({ 
    example: false,
    description: 'Include archived conversations' 
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  includeArchived?: boolean = false;

  @ApiPropertyOptional({ 
    example: 'unread',
    description: 'Filter by unread messages' 
  })
  @IsOptional()
  @IsString()
  filter?: 'unread' | 'all';
}

// Mark Messages as Read DTO
export class MarkAsReadDto {
  @ApiProperty({ 
    example: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012'],
    description: 'Array of message IDs to mark as read' 
  })
  @IsArray()
  @IsMongoId({ each: true })
  messageIds: string[];
}

// Typing Indicator DTO
export class TypingIndicatorDto {
  @ApiProperty({ 
    example: '507f1f77bcf86cd799439011',
    description: 'Conversation ID' 
  })
  @IsMongoId()
  conversationId: string;

  @ApiProperty({ 
    example: true,
    description: 'Whether user is typing' 
  })
  @IsBoolean()
  isTyping: boolean;
}

// Archive Conversation DTO
export class ArchiveConversationDto {
  @ApiProperty({ 
    example: true,
    description: 'Whether to archive or unarchive' 
  })
  @IsBoolean()
  archive: boolean;
}

// Block User DTO
export class BlockUserDto {
  @ApiProperty({ 
    example: '507f1f77bcf86cd799439011',
    description: 'User ID to block' 
  })
  @IsMongoId()
  userId: string;

  @ApiProperty({ 
    example: true,
    description: 'Whether to block or unblock' 
  })
  @IsBoolean()
  block: boolean;
}

// WebSocket Event DTOs
export class WsMessageDto {
  @IsMongoId()
  conversationId: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @IsOptional()
  @IsMongoId()
  replyTo?: string;
}

export class WsTypingDto {
  @IsMongoId()
  conversationId: string;

  @IsBoolean()
  isTyping: boolean;
}

export class WsMarkReadDto {
  @IsMongoId()
  conversationId: string;

  @IsArray()
  @IsMongoId({ each: true })
  messageIds: string[];
}