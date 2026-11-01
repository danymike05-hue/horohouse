import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../schemas/notification.schema';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Recipient user ID' })
  @IsNotEmpty()
  @IsString()
  userId: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type: NotificationType;

  @ApiProperty({ example: 'Booking confirmed' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Your booking at Villa Rosa has been confirmed.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ example: '/bookings/64abc...' })
  @IsString()
  @IsOptional()
  link?: string;

  @ApiPropertyOptional({
    description: 'Arbitrary key-value pairs for deep-linking and analytics',
    example: { bookingId: '64abc...', propertyTitle: 'Villa Rosa', checkIn: '2026-04-10' },
  })
  @IsObject()
  @IsOptional()
  metadata?: {
    propertyId?: string;
    inquiryId?: string;
    senderId?: string;
    // Booking fields
    bookingId?: string;
    reviewId?: string;
    checkIn?: string;
    checkOut?: string;
    guestName?: string;
    hostName?: string;
    propertyTitle?: string;
    amount?: number;
    currency?: string;
    [key: string]: any;
  };
}