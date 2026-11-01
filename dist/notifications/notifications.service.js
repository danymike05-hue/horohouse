"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const notification_schema_1 = require("./schemas/notification.schema");
const admin_send_notification_dto_1 = require("./dto/admin-send-notification.dto");
const notifications_gateway_1 = require("./notifications.gateway");
const push_notifications_service_1 = require("./push-notifications.service");
const email_service_1 = require("../email/email.service");
const user_schema_1 = require("../users/schemas/user.schema");
let NotificationsService = NotificationsService_1 = class NotificationsService {
    notificationModel;
    userModel;
    notificationsGateway;
    pushNotificationsService;
    emailService;
    logger = new common_1.Logger(NotificationsService_1.name);
    constructor(notificationModel, userModel, notificationsGateway, pushNotificationsService, emailService) {
        this.notificationModel = notificationModel;
        this.userModel = userModel;
        this.notificationsGateway = notificationsGateway;
        this.pushNotificationsService = pushNotificationsService;
        this.emailService = emailService;
    }
    async create(createNotificationDto) {
        const rawUserId = createNotificationDto.userId;
        if (!rawUserId || rawUserId === 'undefined' || rawUserId === 'null') {
            this.logger.warn(`Skipping notification creation: invalid or missing userId '${rawUserId}'`);
            throw new common_1.BadRequestException(`Invalid or missing userId '${rawUserId}'`);
        }
        const userIdObj = mongoose_2.Types.ObjectId.isValid(rawUserId)
            ? new mongoose_2.Types.ObjectId(rawUserId)
            : rawUserId;
        const notification = new this.notificationModel({
            ...createNotificationDto,
            userId: userIdObj,
        });
        const saved = await notification.save();
        try {
            this.notificationsGateway.sendNotificationToUser(String(createNotificationDto.userId), saved.toObject());
        }
        catch (wsErr) {
            this.logger.warn(`WebSocket notification emission failed: ${wsErr?.message}`);
        }
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
        }
        catch (pushErr) {
            this.logger.error(`Push notification delivery failed: ${pushErr?.message}`);
        }
        this.logger.log(`Notification created and sent: ${saved._id} for user ${createNotificationDto.userId}`);
        return saved;
    }
    async createBulk(userIds, notificationData) {
        const notifications = userIds.map((userId) => ({
            userId: mongoose_2.Types.ObjectId.isValid(userId) ? new mongoose_2.Types.ObjectId(userId) : userId,
            ...notificationData,
        }));
        const saved = await this.notificationModel.insertMany(notifications);
        saved.forEach((notification) => {
            this.notificationsGateway.sendNotificationToUser(notification.userId.toString(), notification.toObject());
        });
        this.logger.log(`Bulk notifications created and sent: ${saved.length} notifications`);
        return saved;
    }
    async findByUser(userId, query) {
        const { limit = 20, skip = 0, unreadOnly } = query;
        this.logger.log(`[findByUser] Called with userId: ${userId}, query: ${JSON.stringify(query)}`);
        const userStr = userId.toString();
        const userObj = mongoose_2.Types.ObjectId.isValid(userStr) ? new mongoose_2.Types.ObjectId(userStr) : userStr;
        const userFilter = { $in: [userObj, userStr] };
        const filter = { userId: userFilter };
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
                notifications: notifications,
                unreadCount,
                total,
            };
        }
        catch (error) {
            this.logger.error(`[findByUser] Database query error: ${error.message}`);
            throw error;
        }
    }
    async getUnreadCount(userId) {
        try {
            const userStr = userId.toString();
            const userObj = mongoose_2.Types.ObjectId.isValid(userStr) ? new mongoose_2.Types.ObjectId(userStr) : userStr;
            const count = await this.notificationModel.countDocuments({
                userId: { $in: [userObj, userStr] },
                read: false,
            });
            this.logger.log(`[getUnreadCount] User ${userId} has ${count} unread notifications`);
            return count;
        }
        catch (error) {
            this.logger.error(`[getUnreadCount] Error: ${error.message}`);
            throw error;
        }
    }
    async markAsRead(notificationId, userId) {
        try {
            const notification = await this.notificationModel.findOneAndUpdate({
                _id: new mongoose_2.Types.ObjectId(notificationId),
                userId: new mongoose_2.Types.ObjectId(userId),
            }, { read: true }, { new: true });
            if (!notification) {
                this.logger.warn(`[markAsRead] Notification ${notificationId} not found for user ${userId}`);
                throw new common_1.NotFoundException('Notification not found');
            }
            this.notificationsGateway.notifyNotificationRead(userId, notificationId);
            const count = await this.getUnreadCount(userId);
            this.notificationsGateway.sendUnreadCountUpdate(userId, count);
            this.logger.log(`[markAsRead] Marked notification ${notificationId} as read for user ${userId}`);
            return notification;
        }
        catch (error) {
            this.logger.error(`[markAsRead] Error: ${error.message}`);
            throw error;
        }
    }
    async markAllAsRead(userId) {
        try {
            const result = await this.notificationModel.updateMany({ userId: new mongoose_2.Types.ObjectId(userId), read: false }, { read: true });
            this.notificationsGateway.notifyAllRead(userId);
            this.notificationsGateway.sendUnreadCountUpdate(userId, 0);
            this.logger.log(`[markAllAsRead] Marked ${result.modifiedCount} notifications as read for user ${userId}`);
            return { modifiedCount: result.modifiedCount };
        }
        catch (error) {
            this.logger.error(`[markAllAsRead] Error: ${error.message}`);
            throw error;
        }
    }
    async delete(notificationId, userId) {
        try {
            const result = await this.notificationModel.deleteOne({
                _id: new mongoose_2.Types.ObjectId(notificationId),
                userId: new mongoose_2.Types.ObjectId(userId),
            });
            if (result.deletedCount === 0) {
                this.logger.warn(`[delete] Notification ${notificationId} not found for user ${userId}`);
                throw new common_1.NotFoundException('Notification not found');
            }
            this.notificationsGateway.notifyNotificationDeleted(userId, notificationId);
            const count = await this.getUnreadCount(userId);
            this.notificationsGateway.sendUnreadCountUpdate(userId, count);
            this.logger.log(`[delete] Deleted notification ${notificationId} for user ${userId}`);
        }
        catch (error) {
            this.logger.error(`[delete] Error: ${error.message}`);
            throw error;
        }
    }
    async deleteAllRead(userId) {
        try {
            const result = await this.notificationModel.deleteMany({
                userId: new mongoose_2.Types.ObjectId(userId),
                read: true,
            });
            this.logger.log(`[deleteAllRead] Deleted ${result.deletedCount} read notifications for user ${userId}`);
            return { deletedCount: result.deletedCount };
        }
        catch (error) {
            this.logger.error(`[deleteAllRead] Error: ${error.message}`);
            throw error;
        }
    }
    async deleteAllForUser(userId) {
        try {
            const result = await this.notificationModel.deleteMany({
                userId: new mongoose_2.Types.ObjectId(userId),
            });
            this.logger.log(`[deleteAllForUser] Deleted ${result.deletedCount} notifications for user ${userId}`);
            return { deletedCount: result.deletedCount };
        }
        catch (error) {
            this.logger.error(`[deleteAllForUser] Error: ${error.message}`);
            throw error;
        }
    }
    async createInquiryNotification(propertyOwnerId, inquiryId, propertyId, senderName, propertyTitle) {
        return this.create({
            userId: propertyOwnerId,
            type: 'inquiry',
            title: 'New inquiry on your property',
            message: `${senderName} sent an inquiry about ${propertyTitle}`,
            link: `/dashboard/inquiry/${inquiryId}`,
            metadata: {
                propertyId,
                inquiryId,
            },
        });
    }
    async createFavoriteNotification(propertyOwnerId, propertyId, userName, propertyTitle) {
        return this.create({
            userId: propertyOwnerId,
            type: 'favorite',
            title: 'Someone favorited your property',
            message: `${userName} added ${propertyTitle} to their favorites`,
            link: `/properties/${propertyId}`,
            metadata: {
                propertyId,
            },
        });
    }
    async createPropertyUpdateNotification(userId, propertyId, propertyTitle, updateType) {
        return this.create({
            userId,
            type: 'property_update',
            title: 'Property status updated',
            message: `${propertyTitle} has been ${updateType}`,
            link: `/properties/${propertyId}`,
            metadata: {
                propertyId,
                updateType,
            },
        });
    }
    async createInquiryResponseNotification(userId, inquiryId, propertyId, agentName, responseSnippet) {
        const message = responseSnippet
            ? `${agentName} replied: ${responseSnippet}`
            : `${agentName} replied to your inquiry.`;
        return this.create({
            userId,
            type: 'inquiry',
            title: 'Agent replied to your inquiry',
            message,
            link: `/dashboard/inquiry/${inquiryId}`,
            metadata: {
                inquiryId,
                propertyId,
            },
        });
    }
    async notifyBookingRequest(hostId, params) {
        if (hostId && hostId !== 'undefined') {
            try {
                await this.create({
                    userId: hostId,
                    type: notification_schema_1.NotificationType.BOOKING_REQUEST,
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
            }
            catch (hostErr) {
                this.logger.warn(`Failed to notify host ${hostId} for booking request: ${hostErr?.message}`);
            }
        }
        if (params.guestId && params.guestId !== 'undefined') {
            try {
                await this.create({
                    userId: params.guestId,
                    type: notification_schema_1.NotificationType.BOOKING_REQUEST,
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
            }
            catch (guestErr) {
                this.logger.warn(`Failed to notify guest ${params.guestId} for booking request: ${guestErr?.message}`);
            }
        }
    }
    async notifyBookingConfirmed(guestId, params) {
        await this.create({
            userId: guestId,
            type: notification_schema_1.NotificationType.BOOKING_CONFIRMED,
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
    async notifyBookingRejected(guestId, params) {
        await this.create({
            userId: guestId,
            type: notification_schema_1.NotificationType.BOOKING_REJECTED,
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
    async notifyBookingCancelled(params) {
        const cancellerName = params.cancelledByGuest ? params.guestName : params.hostName;
        const otherPartyId = params.cancelledByGuest ? params.hostId : params.guestId;
        const otherPartyMsg = params.cancelledByGuest
            ? `${params.guestName} cancelled their booking for ${params.propertyTitle} ` +
                `(${params.checkIn} → ${params.checkOut})`
            : `${params.hostName} cancelled your booking for ${params.propertyTitle} ` +
                `(${params.checkIn} → ${params.checkOut})`;
        await this.create({
            userId: otherPartyId,
            type: notification_schema_1.NotificationType.BOOKING_CANCELLED,
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
        if (params.refundAmount && params.refundAmount > 0) {
            await this.notifyRefundProcessed(params.guestId, {
                bookingId: params.bookingId,
                propertyTitle: params.propertyTitle,
                amount: params.refundAmount,
                currency: params.currency ?? 'XAF',
            });
        }
    }
    async notifyBookingCompleted(params) {
        await this.create({
            userId: params.guestId,
            type: notification_schema_1.NotificationType.BOOKING_COMPLETED,
            title: 'Your stay is complete',
            message: `We hope you enjoyed your stay at ${params.propertyTitle}!`,
            link: `/bookings/${params.bookingId}`,
            metadata: {
                bookingId: params.bookingId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
            },
        });
        await this.create({
            userId: params.hostId,
            type: notification_schema_1.NotificationType.BOOKING_COMPLETED,
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
        await this.notifyReviewRequest({
            guestId: params.guestId,
            hostId: params.hostId,
            bookingId: params.bookingId,
            propertyId: params.propertyId,
            propertyTitle: params.propertyTitle,
            guestName: params.guestName,
        });
    }
    async notifyCheckInReminder(guestId, params) {
        const timeStr = params.checkInTime ? ` at ${params.checkInTime}` : '';
        await this.create({
            userId: guestId,
            type: notification_schema_1.NotificationType.BOOKING_REMINDER,
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
    async notifyReviewRequest(params) {
        await this.create({
            userId: params.guestId,
            type: notification_schema_1.NotificationType.REVIEW_REQUEST,
            title: 'How was your stay?',
            message: `Share your experience at ${params.propertyTitle} — your review helps other travellers.`,
            link: `/bookings/${params.bookingId}/review`,
            metadata: {
                bookingId: params.bookingId,
                propertyId: params.propertyId,
                propertyTitle: params.propertyTitle,
            },
        });
        await this.create({
            userId: params.hostId,
            type: notification_schema_1.NotificationType.REVIEW_REQUEST,
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
    async notifyReviewReceived(hostId, params) {
        await this.create({
            userId: hostId,
            type: notification_schema_1.NotificationType.REVIEW_RECEIVED,
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
    async notifyReviewsPublished(params) {
        const sharedMeta = {
            bookingId: params.bookingId,
            propertyId: params.propertyId,
            propertyTitle: params.propertyTitle,
        };
        await Promise.all([
            this.create({
                userId: params.guestId,
                type: notification_schema_1.NotificationType.REVIEW_PUBLISHED,
                title: 'Your review is now public',
                message: `Reviews for your stay at ${params.propertyTitle} are now visible to everyone.`,
                link: `/bookings/${params.bookingId}/review`,
                metadata: sharedMeta,
            }),
            this.create({
                userId: params.hostId,
                type: notification_schema_1.NotificationType.REVIEW_PUBLISHED,
                title: 'Reviews published',
                message: `Reviews for the stay at ${params.propertyTitle} are now visible.`,
                link: `/hosting/reviews`,
                metadata: sharedMeta,
            }),
        ]);
    }
    async notifyReviewResponse(guestId, params) {
        await this.create({
            userId: guestId,
            type: notification_schema_1.NotificationType.REVIEW_RESPONSE,
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
    async notifyPaymentReceived(hostId, params) {
        await this.create({
            userId: hostId,
            type: notification_schema_1.NotificationType.PAYMENT_RECEIVED,
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
    async notifyRefundProcessed(guestId, params) {
        await this.create({
            userId: guestId,
            type: notification_schema_1.NotificationType.REFUND_PROCESSED,
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
    async adminSendNotification(adminId, dto) {
        this.logger.log(`[Admin] Admin ${adminId} sending notification: target=${dto.target}, channel=${dto.channel}`);
        const users = await this.resolveTargetUsers(dto);
        if (users.length === 0) {
            this.logger.warn(`[Admin] No users found for target=${dto.target}`);
            return { sent: 0, channel: dto.channel ?? 'push', target: dto.target };
        }
        const channel = dto.channel ?? admin_send_notification_dto_1.AdminNotifChannel.PUSH;
        const type = dto.type ?? notification_schema_1.NotificationType.SYSTEM;
        let sentCount = 0;
        if (channel === admin_send_notification_dto_1.AdminNotifChannel.PUSH || channel === admin_send_notification_dto_1.AdminNotifChannel.BOTH) {
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
            }
            catch (err) {
                this.logger.error(`[Admin] Bulk push send failed: ${err?.message}`);
            }
            for (const uid of userIds) {
                try {
                    await this.pushNotificationsService.sendToUser(uid, {
                        title: dto.title,
                        body: dto.message,
                        data: { route: dto.link },
                    });
                }
                catch (pushErr) {
                    this.logger.warn(`[Admin] Push to user ${uid} failed: ${pushErr?.message}`);
                }
            }
        }
        if (channel === admin_send_notification_dto_1.AdminNotifChannel.EMAIL || channel === admin_send_notification_dto_1.AdminNotifChannel.BOTH) {
            let emailsSent = 0;
            for (const user of users) {
                const email = user.email;
                if (!email)
                    continue;
                try {
                    const displayName = user.firstName
                        ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
                        : email;
                    await this.emailService.sendAdminNotificationEmail(email, displayName, dto.title, dto.message, dto.link);
                    emailsSent++;
                }
                catch (emailErr) {
                    this.logger.warn(`[Admin] Email to ${email} failed: ${emailErr?.message}`);
                }
            }
            this.logger.log(`[Admin] Emails sent: ${emailsSent}/${users.length}`);
            if (channel === admin_send_notification_dto_1.AdminNotifChannel.EMAIL) {
                sentCount = emailsSent;
            }
        }
        return {
            sent: sentCount,
            channel,
            target: dto.target === admin_send_notification_dto_1.AdminNotifTarget.ROLE
                ? `role:${dto.role}`
                : dto.target === admin_send_notification_dto_1.AdminNotifTarget.USERS
                    ? `users:${dto.userIds?.length ?? 0}`
                    : 'all',
        };
    }
    async resolveTargetUsers(dto) {
        const projection = { _id: 1, email: 1, firstName: 1, lastName: 1 };
        switch (dto.target) {
            case admin_send_notification_dto_1.AdminNotifTarget.ALL:
                return this.userModel.find({}, projection).lean().exec();
            case admin_send_notification_dto_1.AdminNotifTarget.ROLE:
                if (!dto.role)
                    throw new common_1.BadRequestException('Role is required when target is "role"');
                return this.userModel.find({ role: dto.role }, projection).lean().exec();
            case admin_send_notification_dto_1.AdminNotifTarget.USERS:
                if (!dto.userIds?.length)
                    throw new common_1.BadRequestException('userIds required when target is "users"');
                const objectIds = dto.userIds
                    .filter(id => mongoose_2.Types.ObjectId.isValid(id))
                    .map(id => new mongoose_2.Types.ObjectId(id));
                return this.userModel.find({ _id: { $in: objectIds } }, projection).lean().exec();
            default:
                throw new common_1.BadRequestException(`Unknown target: ${dto.target}`);
        }
    }
    getAdminStats() {
        return this.notificationsGateway.getGatewayStats();
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(notification_schema_1.Notification.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        notifications_gateway_1.NotificationsGateway,
        push_notifications_service_1.PushNotificationsService,
        email_service_1.EmailService])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map