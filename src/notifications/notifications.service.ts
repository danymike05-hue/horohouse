import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Notification, NotificationDocument, NotificationType } from './schemas/notification.schema';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { AdminSendNotificationDto, AdminNotifTarget, AdminNotifChannel } from './dto/admin-send-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationsGateway } from './notifications.gateway';
import { PushNotificationsService } from './push-notifications.service';
import { EmailService } from '../email/email.service';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    private notificationsGateway: NotificationsGateway,
    private pushNotificationsService: PushNotificationsService,
    private emailService: EmailService,
  ) { }

  /**
   * Create a new notification
   */
  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    const rawUserId = createNotificationDto.userId as any;
    if (!rawUserId || rawUserId === 'undefined' || rawUserId === 'null') {
      this.logger.warn(`Skipping notification creation: invalid or missing userId '${rawUserId}'`);
      throw new BadRequestException(`Invalid or missing userId '${rawUserId}'`);
    }

    const userIdObj = Types.ObjectId.isValid(rawUserId)
      ? new Types.ObjectId(rawUserId)
      : rawUserId;

    const notification = new this.notificationModel({
      ...createNotificationDto,
      userId: userIdObj,
    });
    const saved = await notification.save();

    try {
      this.notificationsGateway.sendNotificationToUser(
        String(createNotificationDto.userId),
        saved.toObject()
      );
    } catch (wsErr: any) {
      this.logger.warn(`WebSocket notification emission failed: ${wsErr?.message}`);
    }

    // 🔥 Actually send an OS-level push (works even when app is backgrounded/killed)
    try {
      await this.pushNotificationsService.sendToUser(String(createNotificationDto.userId), {
        title: createNotificationDto.title,
        body: createNotificationDto.message,
        data: {
          route: createNotificationDto.link,
          notificationId: saved._id.toString(),
          type: createNotificationDto.type,
          metadata: createNotificationDto.metadata,
        },
      });
    } catch (pushErr: any) {
      this.logger.error(`Push notification delivery failed: ${pushErr?.message}`);
    }

    this.logger.log(`Notification created and sent: ${saved._id} for user ${createNotificationDto.userId}`);
    return saved;
  }
  /**
   * Create notification for multiple users
   */
  async createBulk(
    userIds: string[],
    notificationData: Omit<CreateNotificationDto, 'userId'>,
  ): Promise<any[]> {
    const notifications = userIds.map((userId) => ({
      userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId,
      ...notificationData,
    }));

    const saved = await this.notificationModel.insertMany(notifications);

    // 🔥 Emit to all users via WebSocket
    saved.forEach((notification) => {
      this.notificationsGateway.sendNotificationToUser(
        notification.userId.toString(),
        notification.toObject()
      );
    });

    this.logger.log(`Bulk notifications created and sent: ${saved.length} notifications`);

    return saved;
  }


  /**
   * Get user notifications with pagination
   */
  async findByUser(
    userId: string,
    query: QueryNotificationDto,
  ): Promise<{
    notifications: Notification[];
    unreadCount: number;
    total: number;
  }> {
    const { limit = 20, skip = 0, unreadOnly } = query;

    this.logger.log(`[findByUser] Called with userId: ${userId}, query: ${JSON.stringify(query)}`);

    const userStr = userId.toString();
    const userObj = Types.ObjectId.isValid(userStr) ? new Types.ObjectId(userStr) : userStr;
    const userFilter = { $in: [userObj, userStr] };

    const filter: any = { userId: userFilter };
    if (unreadOnly) {
      filter.read = false;
    }

    this.logger.log(`[findByUser] Query filter: ${JSON.stringify(filter)}`);

    try {
      const [notifications, total, unreadCount] = await Promise.all([
        this.notificationModel
          .find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.notificationModel.countDocuments(filter),
        this.notificationModel.countDocuments({
          userId: userFilter,
          read: false,
        }),
      ]);

      this.logger.log(`[findByUser] Query results: ${notifications.length} notifications, ${total} total, ${unreadCount} unread`);

      return {
        notifications: notifications as Notification[],
        unreadCount,
        total,
      };
    } catch (error) {
      this.logger.error(`[findByUser] Database query error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const userStr = userId.toString();
      const userObj = Types.ObjectId.isValid(userStr) ? new Types.ObjectId(userStr) : userStr;
      const count = await this.notificationModel.countDocuments({
        userId: { $in: [userObj, userStr] },
        read: false,
      });

      this.logger.log(`[getUnreadCount] User ${userId} has ${count} unread notifications`);
      return count;
    } catch (error) {
      this.logger.error(`[getUnreadCount] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    try {
      const notification = await this.notificationModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(notificationId),
          userId: new Types.ObjectId(userId),
        },
        { read: true },
        { new: true },
      );

      if (!notification) {
        this.logger.warn(`[markAsRead] Notification ${notificationId} not found for user ${userId}`);
        throw new NotFoundException('Notification not found');
      }

      // 🔥 Emit read event via WebSocket (sync across devices)
      this.notificationsGateway.notifyNotificationRead(userId, notificationId);

      // Update unread count
      const count = await this.getUnreadCount(userId);
      this.notificationsGateway.sendUnreadCountUpdate(userId, count);

      this.logger.log(`[markAsRead] Marked notification ${notificationId} as read for user ${userId}`);
      return notification;
    } catch (error) {
      this.logger.error(`[markAsRead] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    try {
      const result = await this.notificationModel.updateMany(
        { userId: new Types.ObjectId(userId), read: false },
        { read: true },
      );

      // 🔥 Emit all-read event via WebSocket
      this.notificationsGateway.notifyAllRead(userId);
      this.notificationsGateway.sendUnreadCountUpdate(userId, 0);

      this.logger.log(`[markAllAsRead] Marked ${result.modifiedCount} notifications as read for user ${userId}`);
      return { modifiedCount: result.modifiedCount };
    } catch (error) {
      this.logger.error(`[markAllAsRead] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a notification with real-time sync
   */
  async delete(notificationId: string, userId: string): Promise<void> {
    try {
      const result = await this.notificationModel.deleteOne({
        _id: new Types.ObjectId(notificationId),
        userId: new Types.ObjectId(userId),
      });

      if (result.deletedCount === 0) {
        this.logger.warn(`[delete] Notification ${notificationId} not found for user ${userId}`);
        throw new NotFoundException('Notification not found');
      }

      // 🔥 Emit delete event via WebSocket
      this.notificationsGateway.notifyNotificationDeleted(userId, notificationId);

      // Update unread count
      const count = await this.getUnreadCount(userId);
      this.notificationsGateway.sendUnreadCountUpdate(userId, count);

      this.logger.log(`[delete] Deleted notification ${notificationId} for user ${userId}`);
    } catch (error) {
      this.logger.error(`[delete] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete all read notifications
   */
  async deleteAllRead(userId: string): Promise<{ deletedCount: number }> {
    try {
      const result = await this.notificationModel.deleteMany({
        userId: new Types.ObjectId(userId),
        read: true,
      });

      this.logger.log(`[deleteAllRead] Deleted ${result.deletedCount} read notifications for user ${userId}`);
      return { deletedCount: result.deletedCount };
    } catch (error) {
      this.logger.error(`[deleteAllRead] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete all notifications for a user
   */
  async deleteAllForUser(userId: string): Promise<{ deletedCount: number }> {
    try {
      const result = await this.notificationModel.deleteMany({
        userId: new Types.ObjectId(userId),
      });

      this.logger.log(`[deleteAllForUser] Deleted ${result.deletedCount} notifications for user ${userId}`);
      return { deletedCount: result.deletedCount };
    } catch (error) {
      this.logger.error(`[deleteAllForUser] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Helper: Create inquiry notification
   */
  async createInquiryNotification(
    propertyOwnerId: string,
    inquiryId: string,
    propertyId: string,
    senderName: string,
    propertyTitle: string,
  ): Promise<Notification> {
    return this.create({
      userId: propertyOwnerId,
      type: 'inquiry' as any,
      title: 'New inquiry on your property',
      message: `${senderName} sent an inquiry about ${propertyTitle}`,
      link: `/dashboard/inquiry/${inquiryId}`,
      metadata: {
        propertyId,
        inquiryId,
      },
    });
  }

  /**
   * Helper: Create favorite notification
   */
  async createFavoriteNotification(
    propertyOwnerId: string,
    propertyId: string,
    userName: string,
    propertyTitle: string,
  ): Promise<Notification> {
    return this.create({
      userId: propertyOwnerId,
      type: 'favorite' as any,
      title: 'Someone favorited your property',
      message: `${userName} added ${propertyTitle} to their favorites`,
      link: `/properties/${propertyId}`,
      metadata: {
        propertyId,
      },
    });
  }

  /**
   * Helper: Create property update notification
   */
  async createPropertyUpdateNotification(
    userId: string,
    propertyId: string,
    propertyTitle: string,
    updateType: string,
  ): Promise<Notification> {
    return this.create({
      userId,
      type: 'property_update' as any,
      title: 'Property status updated',
      message: `${propertyTitle} has been ${updateType}`,
      link: `/properties/${propertyId}`,
      metadata: {
        propertyId,
        updateType,
      },
    });
  }

  /**
   * Helper: Notify user when an agent replies to their inquiry
   */
  async createInquiryResponseNotification(
    userId: string,
    inquiryId: string,
    propertyId: string,
    agentName: string,
    responseSnippet?: string,
  ): Promise<Notification> {
    const message = responseSnippet
      ? `${agentName} replied: ${responseSnippet}`
      : `${agentName} replied to your inquiry.`;

    return this.create({
      userId,
      type: 'inquiry' as any,
      title: 'Agent replied to your inquiry',
      message,
      link: `/dashboard/inquiry/${inquiryId}`,
      metadata: {
        inquiryId,
        propertyId,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BOOKING LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * HOST ← Guest submitted a booking request.
   *
   * Called from: BookingsService.createBooking()
   * When NOT to call: if property.isInstantBookable = true (use notifyBookingConfirmed instead)
   */
  async notifyBookingRequest(
    hostId: string,
    params: {
      guestId?: string;
      bookingId: string;
      propertyId: string;
      propertyTitle: string;
      guestName: string;
      checkIn: string;   // 'YYYY-MM-DD'
      checkOut: string;
    },
  ): Promise<void> {
    // Notify host
    if (hostId && hostId !== 'undefined') {
      try {
        await this.create({
          userId: hostId,
          type: NotificationType.BOOKING_REQUEST,
          title: 'New booking request 📅',
          message: `${params.guestName} requested to book ${params.propertyTitle} ` +
            `from ${params.checkIn} to ${params.checkOut}`,
          link: `/hosting/bookings/${params.bookingId}`,
          metadata: {
            bookingId: params.bookingId,
            propertyId: params.propertyId,
            propertyTitle: params.propertyTitle,
            guestName: params.guestName,
            checkIn: params.checkIn,
            checkOut: params.checkOut,
          },
        });
      } catch (hostErr: any) {
        this.logger.warn(`Failed to notify host ${hostId} for booking request: ${hostErr?.message}`);
      }
    }

    // Notify guest
    if (params.guestId && params.guestId !== 'undefined') {
      try {
        await this.create({
          userId: params.guestId,
          type: NotificationType.BOOKING_REQUEST,
          title: 'Demande de réservation envoyée 📩',
          message: `Votre demande pour ${params.propertyTitle} (${params.checkIn} → ${params.checkOut}) a bien été transmise à l'hôte.`,
          link: `/bookings/${params.bookingId}`,
          metadata: {
            bookingId: params.bookingId,
            propertyId: params.propertyId,
            propertyTitle: params.propertyTitle,
            checkIn: params.checkIn,
            checkOut: params.checkOut,
          },
        });
      } catch (guestErr: any) {
        this.logger.warn(`Failed to notify guest ${params.guestId} for booking request: ${guestErr?.message}`);
      }
    }
  }

  /**
   * GUEST ← Host confirmed (or instant-book triggered) their booking.
   *
   * Called from: BookingsService.confirmBooking() and BookingsService.createBooking()
   * (for instant-book properties, call this instead of notifyBookingRequest)
   */
  async notifyBookingConfirmed(
    guestId: string,
    params: {
      bookingId: string;
      propertyId: string;
      propertyTitle: string;
      hostName: string;
      checkIn: string;
      checkOut: string;
    },
  ): Promise<void> {
    await this.create({
      userId: guestId,
      type: NotificationType.BOOKING_CONFIRMED,
      title: 'Booking confirmed! 🎉',
      message: `Your stay at ${params.propertyTitle} has been confirmed ` +
        `(${params.checkIn} → ${params.checkOut})`,
      link: `/bookings/${params.bookingId}`,
      metadata: {
        bookingId: params.bookingId,
        propertyId: params.propertyId,
        propertyTitle: params.propertyTitle,
        hostName: params.hostName,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
      },
    });
  }

  /**
   * GUEST ← Host declined their booking request.
   *
   * Called from: BookingsService.rejectBooking()
   */
  async notifyBookingRejected(
    guestId: string,
    params: {
      bookingId: string;
      propertyId: string;
      propertyTitle: string;
      hostName: string;
      checkIn: string;
      checkOut: string;
    },
  ): Promise<void> {
    await this.create({
      userId: guestId,
      type: NotificationType.BOOKING_REJECTED,
      title: 'Booking request declined',
      message: `Unfortunately, ${params.hostName} could not accommodate your request ` +
        `for ${params.propertyTitle} (${params.checkIn} → ${params.checkOut})`,
      link: `/bookings/${params.bookingId}`,
      metadata: {
        bookingId: params.bookingId,
        propertyId: params.propertyId,
        propertyTitle: params.propertyTitle,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
      },
    });
  }

  /**
   * BOTH PARTIES ← A booking was cancelled.
   * Sends two separate notifications — one to each party.
   *
   * Called from: BookingsService.cancelBooking()
   *
   * @param cancelledByGuest  true if the guest cancelled, false if the host did
   */
  async notifyBookingCancelled(
    params: {
      guestId: string;
      hostId: string;
      bookingId: string;
      propertyId: string;
      propertyTitle: string;
      guestName: string;
      hostName: string;
      checkIn: string;
      checkOut: string;
      cancelledByGuest: boolean;
      refundAmount?: number;
      currency?: string;
    },
  ): Promise<void> {
    const cancellerName = params.cancelledByGuest ? params.guestName : params.hostName;

    // ── Notify the OTHER party (the one who did NOT cancel) ──────────────────
    const otherPartyId = params.cancelledByGuest ? params.hostId : params.guestId;
    const otherPartyMsg = params.cancelledByGuest
      ? `${params.guestName} cancelled their booking for ${params.propertyTitle} ` +
      `(${params.checkIn} → ${params.checkOut})`
      : `${params.hostName} cancelled your booking for ${params.propertyTitle} ` +
      `(${params.checkIn} → ${params.checkOut})`;

    await this.create({
      userId: otherPartyId,
      type: NotificationType.BOOKING_CANCELLED,
      title: 'Booking cancelled',
      message: otherPartyMsg,
      link: `/bookings/${params.bookingId}`,
      metadata: {
        bookingId: params.bookingId,
        propertyId: params.propertyId,
        propertyTitle: params.propertyTitle,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
      },
    });

    // ── Notify the guest about any refund ────────────────────────────────────
    if (params.refundAmount && params.refundAmount > 0) {
      await this.notifyRefundProcessed(params.guestId, {
        bookingId: params.bookingId,
        propertyTitle: params.propertyTitle,
        amount: params.refundAmount,
        currency: params.currency ?? 'XAF',
      });
    }
  }

  /**
   * BOTH PARTIES ← Stay has been marked as completed.
   * Also triggers the review prompt for both sides.
   *
   * Called from: BookingsService.completeBooking()
   */
  async notifyBookingCompleted(
    params: {
      guestId: string;
      hostId: string;
      bookingId: string;
      propertyId: string;
      propertyTitle: string;
      guestName: string;
    },
  ): Promise<void> {
    // Notify guest
    await this.create({
      userId: params.guestId,
      type: NotificationType.BOOKING_COMPLETED,
      title: 'Your stay is complete',
      message: `We hope you enjoyed your stay at ${params.propertyTitle}!`,
      link: `/bookings/${params.bookingId}`,
      metadata: {
        bookingId: params.bookingId,
        propertyId: params.propertyId,
        propertyTitle: params.propertyTitle,
      },
    });

    // Notify host
    await this.create({
      userId: params.hostId,
      type: NotificationType.BOOKING_COMPLETED,
      title: 'Stay completed',
      message: `${params.guestName}'s stay at ${params.propertyTitle} has ended.`,
      link: `/hosting/bookings/${params.bookingId}`,
      metadata: {
        bookingId: params.bookingId,
        propertyId: params.propertyId,
        propertyTitle: params.propertyTitle,
        guestName: params.guestName,
      },
    });

    // Prompt both sides to leave a review
    await this.notifyReviewRequest({
      guestId: params.guestId,
      hostId: params.hostId,
      bookingId: params.bookingId,
      propertyId: params.propertyId,
      propertyTitle: params.propertyTitle,
      guestName: params.guestName,
    });
  }

  /**
   * GUEST ← Check-in is approaching (sent 24h before checkIn).
   *
   * Called from: NotificationsScheduler.sendCheckInReminders() (cron job)
   */
  async notifyCheckInReminder(
    guestId: string,
    params: {
      bookingId: string;
      propertyId: string;
      propertyTitle: string;
      checkIn: string;
      checkInTime?: string;  // e.g. "14:00"
    },
  ): Promise<void> {
    const timeStr = params.checkInTime ? ` at ${params.checkInTime}` : '';
    await this.create({
      userId: guestId,
      type: NotificationType.BOOKING_REMINDER,
      title: 'Check-in tomorrow! 🏠',
      message: `Your stay at ${params.propertyTitle} begins tomorrow${timeStr}. ` +
        `Make sure you have the host's contact details ready.`,
      link: `/bookings/${params.bookingId}`,
      metadata: {
        bookingId: params.bookingId,
        propertyId: params.propertyId,
        propertyTitle: params.propertyTitle,
        checkIn: params.checkIn,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // REVIEW LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * BOTH PARTIES ← Prompted to leave a review after checkout.
   * Called immediately after a booking is marked COMPLETED.
   *
   * Note: called internally by notifyBookingCompleted() — no need to call separately.
   */
  async notifyReviewRequest(
    params: {
      guestId: string;
      hostId: string;
      bookingId: string;
      propertyId: string;
      propertyTitle: string;
      guestName: string;
    },
  ): Promise<void> {
    // Prompt guest to review the property
    await this.create({
      userId: params.guestId,
      type: NotificationType.REVIEW_REQUEST,
      title: 'How was your stay?',
      message: `Share your experience at ${params.propertyTitle} — your review helps other travellers.`,
      link: `/bookings/${params.bookingId}/review`,
      metadata: {
        bookingId: params.bookingId,
        propertyId: params.propertyId,
        propertyTitle: params.propertyTitle,
      },
    });

    // Prompt host to review the guest
    await this.create({
      userId: params.hostId,
      type: NotificationType.REVIEW_REQUEST,
      title: 'Review your guest',
      message: `How was ${params.guestName} as a guest? Leave a review to help other hosts.`,
      link: `/hosting/bookings/${params.bookingId}/review`,
      metadata: {
        bookingId: params.bookingId,
        propertyId: params.propertyId,
        propertyTitle: params.propertyTitle,
        guestName: params.guestName,
      },
    });
  }

  /**
   * HOST ← Guest submitted a review for their property.
   *
   * Called from: ReviewsService.createBookingReview() when reviewType = STAY
   */
  async notifyReviewReceived(
    hostId: string,
    params: {
      reviewId: string;
      bookingId: string;
      propertyId: string;
      propertyTitle: string;
      guestName: string;
      rating: number;
    },
  ): Promise<void> {
    await this.create({
      userId: hostId,
      type: NotificationType.REVIEW_RECEIVED,
      title: `New ${params.rating}★ review on ${params.propertyTitle}`,
      message: `${params.guestName} left a review for ${params.propertyTitle}. ` +
        `It will be published once both sides have reviewed.`,
      link: `/hosting/reviews/${params.reviewId}`,
      metadata: {
        reviewId: params.reviewId,
        bookingId: params.bookingId,
        propertyId: params.propertyId,
        propertyTitle: params.propertyTitle,
        guestName: params.guestName,
      },
    });
  }

  /**
   * BOTH PARTIES ← Mutual reviews are now publicly visible.
   * Called when both sides have reviewed OR when the 14-day window expires.
   *
   * Called from: ReviewsService.createBookingReview() (when both submitted)
   *              ReviewsService.publishExpiredReviews() (cron — window expired)
   */
  async notifyReviewsPublished(
    params: {
      guestId: string;
      hostId: string;
      bookingId: string;
      propertyId: string;
      propertyTitle: string;
    },
  ): Promise<void> {
    const sharedMeta = {
      bookingId: params.bookingId,
      propertyId: params.propertyId,
      propertyTitle: params.propertyTitle,
    };

    await Promise.all([
      this.create({
        userId: params.guestId,
        type: NotificationType.REVIEW_PUBLISHED,
        title: 'Your review is now public',
        message: `Reviews for your stay at ${params.propertyTitle} are now visible to everyone.`,
        link: `/bookings/${params.bookingId}/review`,
        metadata: sharedMeta,
      }),
      this.create({
        userId: params.hostId,
        type: NotificationType.REVIEW_PUBLISHED,
        title: 'Reviews published',
        message: `Reviews for the stay at ${params.propertyTitle} are now visible.`,
        link: `/hosting/reviews`,
        metadata: sharedMeta,
      }),
    ]);
  }

  /**
   * GUEST ← Host responded to their review.
   *
   * Called from: ReviewsService.respondToReview()
   */
  async notifyReviewResponse(
    guestId: string,
    params: {
      reviewId: string;
      propertyId: string;
      propertyTitle: string;
      hostName: string;
    },
  ): Promise<void> {
    await this.create({
      userId: guestId,
      type: NotificationType.REVIEW_RESPONSE,
      title: `${params.hostName} responded to your review`,
      message: `The host of ${params.propertyTitle} has responded to your review.`,
      link: `/reviews/${params.reviewId}`,
      metadata: {
        reviewId: params.reviewId,
        propertyId: params.propertyId,
        propertyTitle: params.propertyTitle,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PAYMENT
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * HOST ← Payment has been confirmed for a booking.
   *
   * Called from: BookingsService.updatePayment() when paymentStatus becomes 'paid'
   */
  async notifyPaymentReceived(
    hostId: string,
    params: {
      bookingId: string;
      propertyTitle: string;
      guestName: string;
      amount: number;
      currency: string;
    },
  ): Promise<void> {
    await this.create({
      userId: hostId,
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Payment received',
      message: `Payment of ${params.amount} ${params.currency} received for ` +
        `${params.guestName}'s booking at ${params.propertyTitle}.`,
      link: `/hosting/bookings/${params.bookingId}`,
      metadata: {
        bookingId: params.bookingId,
        propertyTitle: params.propertyTitle,
        guestName: params.guestName,
        amount: params.amount,
        currency: params.currency,
      },
    });
  }

  /**
   * GUEST ← Refund has been processed after cancellation.
   *
   * Called from: NotificationsService.notifyBookingCancelled() when refundAmount > 0
   *              Also callable directly from BookingsService.updatePayment()
   *              when paymentStatus becomes 'refunded'
   */
  async notifyRefundProcessed(
    guestId: string,
    params: {
      bookingId: string;
      propertyTitle: string;
      amount: number;
      currency: string;
    },
  ): Promise<void> {
    await this.create({
      userId: guestId,
      type: NotificationType.REFUND_PROCESSED,
      title: 'Refund processed',
      message: `A refund of ${params.amount} ${params.currency} has been issued ` +
        `for your cancelled booking at ${params.propertyTitle}.`,
      link: `/bookings/${params.bookingId}`,
      metadata: {
        bookingId: params.bookingId,
        propertyTitle: params.propertyTitle,
        amount: params.amount,
        currency: params.currency,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN — Send Notifications
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Admin: Send a notification (push / email / both) to all users,
   * a specific role, or a list of specific users.
   */
  async adminSendNotification(
    adminId: string,
    dto: AdminSendNotificationDto,
  ): Promise<{
    sent: number;
    channel: string;
    target: string;
  }> {
    this.logger.log(`[Admin] Admin ${adminId} sending notification: target=${dto.target}, channel=${dto.channel}`);

    // 1) Resolve target users
    const users = await this.resolveTargetUsers(dto);

    if (users.length === 0) {
      this.logger.warn(`[Admin] No users found for target=${dto.target}`);
      return { sent: 0, channel: dto.channel ?? 'push', target: dto.target };
    }

    const channel = dto.channel ?? AdminNotifChannel.PUSH;
    const type = dto.type ?? NotificationType.SYSTEM;
    let sentCount = 0;

    // 2) Send in-app push notification (creates DB record + WebSocket + OS push)
    if (channel === AdminNotifChannel.PUSH || channel === AdminNotifChannel.BOTH) {
      const userIds = users.map(u => u._id.toString());

      try {
        await this.createBulk(userIds, {
          type,
          title: dto.title,
          message: dto.message,
          link: dto.link,
          metadata: {
            ...dto.metadata,
            sentByAdmin: adminId,
          },
        });
        sentCount = userIds.length;
        this.logger.log(`[Admin] Push notifications sent to ${userIds.length} users`);
      } catch (err: any) {
        this.logger.error(`[Admin] Bulk push send failed: ${err?.message}`);
      }

      // Also send OS-level push to each user
      for (const uid of userIds) {
        try {
          await this.pushNotificationsService.sendToUser(uid, {
            title: dto.title,
            body: dto.message,
            data: { route: dto.link },
          });
        } catch (pushErr: any) {
          this.logger.warn(`[Admin] Push to user ${uid} failed: ${pushErr?.message}`);
        }
      }
    }

    // 3) Send email
    if (channel === AdminNotifChannel.EMAIL || channel === AdminNotifChannel.BOTH) {
      let emailsSent = 0;

      for (const user of users) {
        const email = user.email;
        if (!email) continue;

        try {
          const displayName = user.firstName
            ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
            : email;

          await this.emailService.sendAdminNotificationEmail(
            email,
            displayName,
            dto.title,
            dto.message,
            dto.link,
          );
          emailsSent++;
        } catch (emailErr: any) {
          this.logger.warn(`[Admin] Email to ${email} failed: ${emailErr?.message}`);
        }
      }

      this.logger.log(`[Admin] Emails sent: ${emailsSent}/${users.length}`);
      if (channel === AdminNotifChannel.EMAIL) {
        sentCount = emailsSent;
      }
    }

    return {
      sent: sentCount,
      channel,
      target: dto.target === AdminNotifTarget.ROLE
        ? `role:${dto.role}`
        : dto.target === AdminNotifTarget.USERS
          ? `users:${dto.userIds?.length ?? 0}`
          : 'all',
    };
  }

  /**
   * Resolve which users to target based on the AdminSendNotificationDto.
   */
  private async resolveTargetUsers(
    dto: AdminSendNotificationDto,
  ): Promise<Array<{ _id: Types.ObjectId; email?: string; firstName?: string; lastName?: string }>> {
    const projection = { _id: 1, email: 1, firstName: 1, lastName: 1 };

    switch (dto.target) {
      case AdminNotifTarget.ALL:
        return this.userModel.find({}, projection).lean().exec();

      case AdminNotifTarget.ROLE:
        if (!dto.role) throw new BadRequestException('Role is required when target is "role"');
        return this.userModel.find({ role: dto.role }, projection).lean().exec();

      case AdminNotifTarget.USERS:
        if (!dto.userIds?.length) throw new BadRequestException('userIds required when target is "users"');
        const objectIds = dto.userIds
          .filter(id => Types.ObjectId.isValid(id))
          .map(id => new Types.ObjectId(id));
        return this.userModel.find({ _id: { $in: objectIds } }, projection).lean().exec();

      default:
        throw new BadRequestException(`Unknown target: ${dto.target}`);
    }
  }

  /**
   * Admin: Get WebSocket gateway statistics.
   */
  getAdminStats() {
    return this.notificationsGateway.getGatewayStats();
  }

}