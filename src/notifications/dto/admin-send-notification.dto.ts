import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../schemas/notification.schema';

/**
 * Delivery channels for admin notifications.
 */
export enum AdminNotifChannel {
  /** In-app push + WebSocket */
  PUSH = 'push',
  /** Email via Resend */
  EMAIL = 'email',
  /** Both in-app push and email */
  BOTH = 'both',
}

/**
 * Target audience for admin notifications.
 */
export enum AdminNotifTarget {
  /** All users on the platform */
  ALL = 'all',
  /** Users matching a specific role */
  ROLE = 'role',
  /** Specific user IDs (personal message) */
  USERS = 'users',
}

export class AdminSendNotificationDto {
  // ── Target ─────────────────────────────────────────────────────────────────

  @ApiProperty({ enum: AdminNotifTarget, description: 'Who should receive this notification' })
  @IsEnum(AdminNotifTarget)
  @IsNotEmpty()
  target: AdminNotifTarget;

  @ApiPropertyOptional({ description: 'Role filter (required when target = "role")', example: 'host' })
  @ValidateIf(o => o.target === AdminNotifTarget.ROLE)
  @IsString()
  @IsNotEmpty()
  role?: string;

  @ApiPropertyOptional({
    description: 'User IDs (required when target = "users")',
    example: ['64abc123...', '64def456...'],
  })
  @ValidateIf(o => o.target === AdminNotifTarget.USERS)
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  // ── Content ────────────────────────────────────────────────────────────────

  @ApiProperty({ example: 'Platform Maintenance 🔧' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'We will be performing scheduled maintenance tonight from 2 AM to 4 AM.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ enum: NotificationType, default: NotificationType.SYSTEM })
  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType = NotificationType.SYSTEM;

  @ApiPropertyOptional({ description: 'Deep link route', example: '/support' })
  @IsString()
  @IsOptional()
  link?: string;

  // ── Delivery channel ───────────────────────────────────────────────────────

  @ApiProperty({ enum: AdminNotifChannel, default: AdminNotifChannel.PUSH })
  @IsEnum(AdminNotifChannel)
  @IsOptional()
  channel?: AdminNotifChannel = AdminNotifChannel.PUSH;

  // ── Extra metadata ─────────────────────────────────────────────────────────

  @ApiPropertyOptional({ description: 'Arbitrary metadata attached to the notification' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
