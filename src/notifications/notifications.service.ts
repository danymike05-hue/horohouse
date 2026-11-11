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
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Property } from '../properties/schemas/property.schema';
import { listingCoverUrl, pushImageUrl } from './push-image';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Property.name)
    private propertyModel: Model<any>,
    private notificationsGateway: NotificationsGateway,
    private pushNotificationsService: PushNotificationsService,
    private emailService: EmailService,
  ) { }

  /**
   * Create a new notification.
   *
   * `fr` is the same notification in French. It's used when the recipient's app is in
   * French (users.appLanguage, which the app sends from Settings). Without it, or for
   * anyone else, the main title and message are used.
   */
  async create(
    createNotificationDto: CreateNotificationDto,
    fr?: { title: string; message: string },
  ): Promise<Notification> {
    const rawUserId = createNotificationDto.userId as any;
    if (!rawUserId || rawUserId === 'undefined' || rawUserId === 'null') {
      this.logger.warn(`Skipping notification creation: invalid or missing userId '${rawUserId}'`);
      throw new BadRequestException(`Invalid or missing userId '${rawUserId}'`);
    }
    // The French version can also come on the notification itself, as `fr`, which is
    // handy for helpers that pass their params straight through. It's never saved.
    const { fr: inlineFr, ...dtoWithoutFr } = createNotificationDto as CreateNotificationDto & { fr?: { title: string; message: string } };
    createNotificationDto = dtoWithoutFr as CreateNotificationDto;
    fr = fr ?? inlineFr;
    if (fr && (await this.languageOf(String(rawUserId))) === 'fr') {
      createNotificationDto = { ...createNotificationDto, title: fr.title, message: fr.message };
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

    // Settings → Notifications: the in-app list always gets it; the phone push
    // only if the user wants this kind (account / payment notices always go)
    if (!(await this.wantsPush(String(createNotificationDto.userId), createNotificationDto.type))) {
      this.logger.log(`Push skipped (user preference): ${saved._id}`);
      return saved;
    }

    // 🔥 Actually send an OS-level push (works even when app is backgrounded/killed)
    try {
      const image = await this.pushImageFor(createNotificationDto.metadata);
      await this.pushNotificationsService.sendToUser(String(createNotificationDto.userId), {
        title: createNotificationDto.title,
        body: createNotificationDto.message,
        image,
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
  /** The language the user's app is set to, when the app has told us. */
  private async languageOf(userId: string): Promise<'en' | 'fr' | undefined> {
    if (!Types.ObjectId.isValid(userId)) return undefined;
    try {
      const u: any = await this.userModel.findById(userId).select('appLanguage').lean().exec();
      return u?.appLanguage === 'fr' ? 'fr' : u?.appLanguage === 'en' ? 'en' : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Photo for the phone notification, like Airbnb: an explicit metadata.image,
   * otherwise the main photo of the listing it's about (bookings, reviews…).
   * Never blocks the push: any failure just means no photo.
   */
  private async pushImageFor(metadata?: Record<string, any>): Promise<string | undefined> {
    try {
      const explicit = pushImageUrl(metadata?.image);
      if (explicit) return explicit;
      const propertyId = metadata?.propertyId ? String(metadata.propertyId) : '';
      if (!Types.ObjectId.isValid(propertyId)) return undefined;
      const p: any = await this.propertyModel.findById(propertyId).select('images').lean().exec();
      return listingCoverUrl(p?.images);
    } catch {
      return undefined;
    }
  }

  /** Push groups the user can turn off; anything else is always sent */
  private static readonly PUSH_GROUPS: Record<string, 'messages' | 'bookings' | 'reminders' | 'reviews'> = {
    [NotificationType.MESSAGE]: 'messages',
    [NotificationType.BOOKING_REQUEST]: 'bookings',
    [NotificationType.BOOKING_CONFIRMED]: 'bookings',
    [NotificationType.BOOKING_CANCELLED]: 'bookings',
    [NotificationType.BOOKING_REJECTED]: 'bookings',
    [NotificationType.BOOKING_COMPLETED]: 'bookings',
    [NotificationType.VIEWING]: 'bookings',
    [NotificationType.BOOKING_REMINDER]: 'reminders',
    [NotificationType.REVIEW_REQUEST]: 'reminders',
    [NotificationType.REVIEW_RECEIVED]: 'reviews',
    [NotificationType.REVIEW_PUBLISHED]: 'reviews',
    [NotificationType.REVIEW_RESPONSE]: 'reviews',
  };

  /** Does this user want a phone push for this kind of notification? */
  async wantsPush(userId: string, type?: string): Promise<boolean> {
    const group = type ? NotificationsService.PUSH_GROUPS[type] : undefined;
    if (!group) return true; // payments, refunds, security, system notices
    try {
      if (!Types.ObjectId.isValid(userId)) return true;
      const u: any = await this.userModel.findById(userId).select('pushNotifications notificationPrefs').lean().exec();
      if (!u) return true;
      if (u.pushNotifications === false) return false;
      return u.notificationPrefs?.[group] !== false;
    } catch {
      return true; // never lose a notice because the check failed
    }
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
      fr: { title: 'Nouvelle demande sur votre logement', message: `${senderName} a envoyé une demande au sujet de ${propertyTitle}` },
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
      fr: { title: 'Votre logement a été ajouté aux favoris', message: `${userName} a ajouté ${propertyTitle} à ses favoris` },
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
      fr: { title: 'Statut du logement mis à jour', message: `${propertyTitle} : ${updateType}` },
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
      fr: { title: "L'agent a répondu à votre demande", message: responseSnippet ? `${agentName} a répondu : ${responseSnippet}` : `${agentName} a répondu à votre demande.` },
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
          fr: { title: 'Nouvelle demande de réservation 📅', message: `${params.guestName} souhaite réserver ${params.propertyTitle} du ${params.checkIn} au ${params.checkOut}` },
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
          title: 'Booking request sent 📩',
          message: `Your request for ${params.propertyTitle} (${params.checkIn} → ${params.checkOut}) has been sent to the host.`,
          fr: { title: 'Demande de réservation envoyée 📩', message: `Votre demande pour ${params.propertyTitle} (${params.checkIn} → ${params.checkOut}) a bien été transmise à l'hôte.` },
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
      fr: { title: 'Réservation confirmée ! 🎉', message: `Votre séjour à ${params.propertyTitle} est confirmé (${params.checkIn} → ${params.checkOut})` },
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
      fr: { title: 'Demande de réservation refusée', message: `Malheureusement, ${params.hostName} ne peut pas accepter votre demande pour ${params.propertyTitle} (${params.checkIn} → ${params.checkOut})` },
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
      fr: { title: 'Réservation annulée', message: params.cancelledByGuest ? `${params.guestName} a annulé sa réservation pour ${params.propertyTitle} (${params.checkIn} → ${params.checkOut})` : `${params.hostName} a annulé votre réservation pour ${params.propertyTitle} (${params.checkIn} → ${params.checkOut})` },
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
      fr: { title: 'Votre séjour est terminé', message: `Nous espérons que vous avez apprécié votre séjour à ${params.propertyTitle} !` },
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
      fr: { title: 'Séjour terminé', message: `Le séjour de ${params.guestName} à ${params.propertyTitle} est terminé.` },
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
      fr: { title: 'Arrivée demain ! 🏠', message: `Votre séjour à ${params.propertyTitle} commence demain${params.checkInTime ? ` à ${params.checkInTime}` : ''}. Gardez les coordonnées de votre hôte à portée de main.` },
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
      fr: { title: "Comment s'est passé votre séjour ?", message: `Racontez votre séjour à ${params.propertyTitle} : votre avis aide les autres voyageurs.` },
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
      fr: { title: 'Évaluez votre voyageur', message: `Comment s'est passé le séjour avec ${params.guestName} ? Laissez un avis pour aider les autres hôtes.` },
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
      fr: { title: `Nouvel avis ${params.rating}★ sur ${params.propertyTitle}`, message: `${params.guestName} a laissé un avis sur ${params.propertyTitle}. Il sera publié quand vous aurez tous les deux laissé le vôtre.` },
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
        fr: { title: 'Votre avis est maintenant public', message: `Les avis sur votre séjour à ${params.propertyTitle} sont maintenant visibles par tous.` },
        link: `/bookings/${params.bookingId}/review`,
        metadata: sharedMeta,
      }),
      this.create({
        userId: params.hostId,
        type: NotificationType.REVIEW_PUBLISHED,
        title: 'Reviews published',
        message: `Reviews for the stay at ${params.propertyTitle} are now visible.`,
        fr: { title: 'Avis publiés', message: `Les avis sur le séjour à ${params.propertyTitle} sont maintenant visibles.` },
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
      fr: { title: `${params.hostName} a répondu à votre avis`, message: `L'hôte de ${params.propertyTitle} a répondu à votre avis.` },
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
      /** When the money can be withdrawn */
      availableOn?: Date;
    },
  ): Promise<void> {
    const day = params.availableOn?.toISOString().split('T')[0];
    const when = day ? ` You can withdraw it from ${day}, about a day after check-in.` : '';
    const quand = day ? ` Vous pourrez le retirer à partir du ${day}, environ un jour après l'arrivée.` : '';
    await this.create({
      userId: hostId,
      type: NotificationType.PAYMENT_RECEIVED,
      title: 'Payment received',
      message: `Payment of ${params.amount} ${params.currency} received for ` +
        `${params.guestName}'s booking at ${params.propertyTitle}.${when}`,
      link: `/hosting/bookings/${params.bookingId}`,
      metadata: {
        bookingId: params.bookingId,
        propertyTitle: params.propertyTitle,
        guestName: params.guestName,
        amount: params.amount,
        currency: params.currency,
      },
    }, {
      title: 'Paiement reçu',
      message: `Paiement de ${params.amount} ${params.currency} reçu pour la réservation de ` +
        `${params.guestName} à ${params.propertyTitle}.${quand}`,
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
      /** For a reported problem or a date change: the booking wasn't necessarily cancelled */
      forStay?: boolean;
    },
  ): Promise<void> {
    await this.create({
      userId: guestId,
      type: NotificationType.REFUND_PROCESSED,
      title: 'Refund processed',
      message: `A refund of ${params.amount} ${params.currency} has been issued ` +
        `for your ${params.forStay ? 'stay' : 'cancelled booking'} at ${params.propertyTitle}.`,
      fr: { title: 'Remboursement effectué', message: `Un remboursement de ${params.amount} ${params.currency} a été effectué pour votre ${params.forStay ? 'séjour' : 'réservation annulée'} à ${params.propertyTitle}.` },
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
   * Tells every active admin (in-app, push and email) that something needs a person:
   * a payment to refund, a failed refund, a host wallet that couldn't be debited…
   * These were only written to the server log, where nobody would see them.
   * Never throws: an alert must not break the payment flow that raised it.
   */
  async notifyAdmins(params: { title: string; message: string; link?: string; metadata?: Record<string, any> }): Promise<void> {
    try {
      const admins = await this.userModel
        .find({ role: UserRole.ADMIN, isActive: { $ne: false } }, { _id: 1, email: 1, name: 1 })
        .lean()
        .exec();
      if (!admins.length) {
        this.logger.error(`[AdminAlert] No admin account to alert: ${params.title} — ${params.message}`);
        return;
      }
      const ids = admins.map((a: any) => String(a._id));
      await this.createBulk(ids, {
        type: NotificationType.SYSTEM,
        title: params.title,
        message: params.message,
        link: params.link,
        metadata: { ...(params.metadata ?? {}), adminAlert: true },
      } as any);
      for (const a of admins as any[]) {
        this.pushNotificationsService
          .sendToUser(String(a._id), { title: params.title, body: params.message, data: { route: params.link } })
          .catch(() => undefined);
        if (a.email) {
          this.emailService
            .sendAdminNotificationEmail(a.email, a.name || a.email, params.title, params.message, params.link)
            .catch((e: any) => this.logger.warn(`[AdminAlert] email to ${a.email} failed: ${e?.message}`));
        }
      }
      this.logger.warn(`[AdminAlert] ${params.title} — sent to ${ids.length} admin(s)`);
    } catch (err: any) {
      this.logger.error(`[AdminAlert] failed (${params.title}): ${err?.message}`);
    }
  }

  /**
   * Admin: Get WebSocket gateway statistics.
   */
  getAdminStats() {
    return this.notificationsGateway.getGatewayStats();
  }

}