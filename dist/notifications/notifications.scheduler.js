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
var NotificationsScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const notifications_service_1 = require("./notifications.service");
const notification_schema_1 = require("./schemas/notification.schema");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const reviews_service_1 = require("../reviews/reviews.service");
let NotificationsScheduler = NotificationsScheduler_1 = class NotificationsScheduler {
    notificationsService;
    reviewsService;
    bookingModel;
    logger = new common_1.Logger(NotificationsScheduler_1.name);
    constructor(notificationsService, reviewsService, bookingModel) {
        this.notificationsService = notificationsService;
        this.reviewsService = reviewsService;
        this.bookingModel = bookingModel;
    }
    async sendCheckInReminders() {
        this.logger.log('[Scheduler] Running check-in reminder job');
        const now = new Date();
        const windowMin = new Date(now.getTime() + 20 * 60 * 60 * 1000);
        const windowMax = new Date(now.getTime() + 28 * 60 * 60 * 1000);
        try {
            const upcomingBookings = await this.bookingModel
                .find({
                status: booking_schema_1.BookingStatus.CONFIRMED,
                checkIn: { $gte: windowMin, $lte: windowMax },
            })
                .populate('propertyId', 'title shortTermAmenities')
                .lean()
                .exec();
            this.logger.log(`[Scheduler] Found ${upcomingBookings.length} booking(s) with check-in in ~24h`);
            for (const booking of upcomingBookings) {
                const property = booking.propertyId;
                const checkInTime = property?.shortTermAmenities?.checkInTime;
                await this.notificationsService.notifyCheckInReminder(booking.guestId.toString(), {
                    bookingId: booking._id.toString(),
                    propertyId: property?._id?.toString() ?? '',
                    propertyTitle: property?.title ?? 'your upcoming stay',
                    checkIn: booking.checkIn.toISOString().split('T')[0],
                    checkInTime,
                });
            }
        }
        catch (error) {
            this.logger.error('[Scheduler] Check-in reminder job failed:', error);
        }
    }
    async sendReviewReminders() {
        this.logger.log('[Scheduler] Running review reminder job');
        const now = new Date();
        const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
        try {
            const completedBookings = await this.bookingModel
                .find({
                status: booking_schema_1.BookingStatus.COMPLETED,
                checkOut: { $gte: fourDaysAgo, $lte: threeDaysAgo },
                $or: [
                    { guestReviewLeft: false },
                    { hostReviewLeft: false },
                ],
            })
                .populate('propertyId', 'title')
                .lean()
                .exec();
            this.logger.log(`[Scheduler] Found ${completedBookings.length} booking(s) pending review reminders`);
            for (const booking of completedBookings) {
                const property = booking.propertyId;
                const propertyTitle = property?.title ?? 'your recent stay';
                const bookingId = booking._id.toString();
                if (!booking.guestReviewLeft) {
                    await this.notificationsService.create({
                        userId: booking.guestId.toString(),
                        type: notification_schema_1.NotificationType.REVIEW_REQUEST,
                        title: 'How was your stay?',
                        message: `Share your experience at ${propertyTitle} — your review helps other travellers.`,
                        link: `/bookings/${bookingId}/review`,
                        metadata: {
                            bookingId,
                            propertyId: property?._id?.toString() ?? '',
                            propertyTitle,
                        },
                    });
                }
                if (!booking.hostReviewLeft) {
                    await this.notificationsService.create({
                        userId: booking.hostId.toString(),
                        type: notification_schema_1.NotificationType.REVIEW_REQUEST,
                        title: 'Review your guest',
                        message: `How was ${property?.guestName ?? 'your guest'} as a guest? Leave a review to help other hosts.`,
                        link: `/hosting/bookings/${bookingId}/review`,
                        metadata: {
                            bookingId,
                            propertyId: property?._id?.toString() ?? '',
                            propertyTitle,
                        },
                    });
                }
            }
        }
        catch (error) {
            this.logger.error('[Scheduler] Review reminder job failed:', error);
        }
    }
    async publishExpiredReviews() {
        try {
            const published = await this.reviewsService.publishExpiredReviews();
            if (published > 0) {
                this.logger.log(`[Scheduler] Published ${published} expired review(s). ` +
                    'REVIEW_PUBLISHED notifications should be fired from ReviewsService.');
            }
        }
        catch (error) {
            this.logger.error('[Scheduler] Publish expired reviews job failed:', error);
        }
    }
};
exports.NotificationsScheduler = NotificationsScheduler;
__decorate([
    (0, schedule_1.Cron)('0 10 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationsScheduler.prototype, "sendCheckInReminders", null);
__decorate([
    (0, schedule_1.Cron)('0 11 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationsScheduler.prototype, "sendReviewReminders", null);
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationsScheduler.prototype, "publishExpiredReviews", null);
exports.NotificationsScheduler = NotificationsScheduler = NotificationsScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService,
        reviews_service_1.ReviewsService,
        mongoose_2.Model])
], NotificationsScheduler);
//# sourceMappingURL=notifications.scheduler.js.map