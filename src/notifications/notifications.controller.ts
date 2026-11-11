import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { AdminSendNotificationDto } from './dto/admin-send-notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt.auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '../users/schemas/user.schema';
import { NotificationType } from './schemas/notification.schema';

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Extracts the user ID from the request regardless of whether the JWT strategy
 * attaches it as `userId` or `_id` (different auth setups vary).
 * Throws UnauthorizedException if neither is present.
 */
function extractUserId(req: any): string {
  const userId = req.user?.userId ?? req.user?._id?.toString() ?? req.user?.id;
  if (!userId) {
    throw new UnauthorizedException('User ID not found in token');
  }
  return userId;
}

// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Throttle({ default: { limit: 200, ttl: 60000 } })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ════════════════════════════════════════════════════════════════════════════
  // READ
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * GET /notifications
   * Returns paginated notifications for the current user.
   * Supports filtering by type family (booking, review, payment, etc.)
   * via the existing QueryNotificationDto `type` field.
   */
  @Get()
  @ApiOperation({ summary: 'Get notifications for the current user' })
  @ApiQuery({ name: 'limit',      required: false, type: Number,  description: 'Max results (default 20)' })
  @ApiQuery({ name: 'skip',       required: false, type: Number,  description: 'Offset for pagination' })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean, description: 'Return only unread notifications' })
  @ApiQuery({
    name:        'type',
    required:    false,
    enum:        NotificationType,
    description: 'Filter by notification type (booking_request, review_received, etc.)',
  })
  @ApiResponse({ status: 200, description: 'Paginated notifications with unread count' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotifications(
    @Req() req: any,
    @Query() query: QueryNotificationDto,
  ) {
    const userId = extractUserId(req);
    return this.notificationsService.findByUser(userId, query);
  }

  /**
   * GET /notifications/unread-count
   * Lightweight endpoint polled by the frontend notification bell.
   */
  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({ status: 200, description: '{ count: number }' })
  async getUnreadCount(@Req() req: any) {
    const userId = extractUserId(req);
    const count  = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MARK AS READ
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * PATCH /notifications/read-all
   * Must be declared BEFORE /:id routes to avoid NestJS matching "read-all" as an ID.
   */
  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({ status: 200, description: '{ modifiedCount: number }' })
  async markAllAsRead(@Req() req: any) {
    const userId = extractUserId(req);
    return this.notificationsService.markAllAsRead(userId);
  }

  /**
   * PATCH /notifications/:id/read
   */
  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Updated notification' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @Req() req: any,
    @Param('id') notificationId: string,
  ) {
    const userId = extractUserId(req);
    return this.notificationsService.markAsRead(notificationId, userId);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // TEST
  // ════════════════════════════════════════════════════════════════════════════

  @Post('test')
  @ApiOperation({ summary: 'Trigger a test notification for the user' })
  @ApiResponse({ status: 201, description: 'Test notification triggered' })
  async triggerTestNotification(@Req() req: any) {
    const userId = extractUserId(req);
    const created = await this.notificationsService.create({
      userId,
      type: 'booking_confirmed' as any,
      title: 'Real Test Notification 🚀',
      message: 'This is a genuine system notification sent through the backend that triggers WebSockets!',
      link: '/bookings/test-id-123',
      metadata: {
        bookingId: 'test-id-123',
        propertyTitle: 'HoroHouse HQ',
      },
    });
    return (created as any)?.toObject ? (created as any).toObject() : created;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DELETE
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * DELETE /notifications/read
   * Clears all already-read notifications for the user.
   * Must be declared BEFORE /:id to avoid route totoing.
   */
  @Delete('read')
  @ApiOperation({ summary: 'Delete all read notifications' })
  @ApiResponse({ status: 200, description: '{ deletedCount: number }' })
  async deleteAllRead(@Req() req: any) {
    const userId = extractUserId(req);
    return this.notificationsService.deleteAllRead(userId);
  }

  /**
   * DELETE /notifications/all
   * Nuclear option — wipes every notification for the user.
   */
  @Delete('all')
  @ApiOperation({ summary: 'Delete all notifications for the current user' })
  @ApiResponse({ status: 200, description: '{ deletedCount: number }' })
  async deleteAll(@Req() req: any) {
    const userId = extractUserId(req);
    return this.notificationsService.deleteAllForUser(userId);
  }

  /**
   * DELETE /notifications/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a single notification' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  @ApiResponse({ status: 204, description: 'Deleted' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async deleteNotification(
    @Req() req: any,
    @Param('id') notificationId: string,
  ) {
    const userId = extractUserId(req);
    await this.notificationsService.delete(notificationId, userId);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ADMIN — Send Notifications
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * POST /notifications/admin/send
   * Admin-only: Send a general broadcast, role-targeted, or personal
   * notification via in-app push, email, or both channels.
   */
  @Post('admin/send')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Send notification to users' })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async adminSendNotification(
    @Req() req: any,
    @Body() dto: AdminSendNotificationDto,
  ) {
    const adminId = extractUserId(req);
    return this.notificationsService.adminSendNotification(adminId, dto);
  }

  /**
   * GET /notifications/admin/stats
   * Admin-only: Get WebSocket gateway statistics.
   */
  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '[Admin] Get notification gateway statistics' })
  @ApiResponse({ status: 200, description: 'Gateway stats' })
  async adminGetStats() {
    return this.notificationsService.getAdminStats();
  }
}