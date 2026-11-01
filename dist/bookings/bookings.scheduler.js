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
var BookingsScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookingsScheduler = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const schedule_1 = require("@nestjs/schedule");
const mongoose_2 = require("mongoose");
const booking_schema_1 = require("./schema/booking.schema");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_schema_1 = require("../notifications/schemas/notification.schema");
const AUTO_CANCEL_HOURS = 24;
const NO_SHOW_GRACE_HOURS = 24;
let BookingsScheduler = BookingsScheduler_1 = class BookingsScheduler {
    bookingModel;
    notificationsService;
    logger = new common_1.Logger(BookingsScheduler_1.name);
    constructor(bookingModel, notificationsService) {
        this.bookingModel = bookingModel;
        this.notificationsService = notificationsService;
    }
    async autoCancelUnpaidBookings() {
        const cutoff = new Date(Date.now() - AUTO_CANCEL_HOURS * 3_600_000);
        try {
            const expiredBookings = await this.bookingModel
                .find({
                paymentStatus: booking_schema_1.PaymentStatus.UNPAID,
                $or: [
                    { status: booking_schema_1.BookingStatus.PENDING, createdAt: { $lt: cutoff } },
                    { status: booking_schema_1.BookingStatus.CONFIRMED, confirmedAt: { $lt: cutoff } },
                ],
            })
                .populate('propertyId', 'title')
                .lean()
                .exec();
            if (expiredBookings.length === 0)
                return;
            let cancelledCount = 0;
            for (const booking of expiredBookings) {
                try {
                    const wasConfirmed = booking.status === booking_schema_1.BookingStatus.CONFIRMED;
                    const reason = wasConfirmed
                        ? `Automatically cancelled: payment not received within ${AUTO_CANCEL_HOURS} hours of host confirmation`
                        : `Automatically cancelled: payment not received within ${AUTO_CANCEL_HOURS} hours`;
                    await this.bookingModel.findByIdAndUpdate(booking._id, {
                        $set: {
                            status: booking_schema_1.BookingStatus.CANCELLED,
                            cancellation: {
                                cancelledBy: booking_schema_1.CancelledBy.SYSTEM,
                                cancelledAt: new Date(),
                                reason,
                                refundAmount: 0,
                            },
                        },
                    });
                    const propertyTitle = booking.propertyId?.title ?? 'the property';
                    const fmt = (d) => new Date(d).toISOString().split('T')[0];
                    const checkIn = fmt(booking.checkIn);
                    const checkOut = fmt(booking.checkOut);
                    await this.notificationsService.create({
                        userId: booking.guestId.toString(),
                        type: notification_schema_1.NotificationType.BOOKING_CANCELLED,
                        title: 'Booking cancelled — payment timeout ⏰',
                        message: `Your reservation at ${propertyTitle} ` +
                            `(${checkIn} → ${checkOut}) was automatically cancelled ` +
                            `because payment was not completed within ${AUTO_CANCEL_HOURS} hours. ` +
                            `The dates are now available for other guests.`,
                        link: `/bookings/${booking._id.toString()}`,
                        metadata: {
                            bookingId: booking._id.toString(),
                            propertyId: booking.propertyId?._id?.toString() ?? booking.propertyId?.toString(),
                            propertyTitle,
                            checkIn,
                            checkOut,
                        },
                    });
                    cancelledCount++;
                }
                catch (bookingErr) {
                    this.logger.warn(`Auto-cancel: failed to process booking ${booking._id}: ${bookingErr.message}`);
                }
            }
            if (cancelledCount > 0) {
                this.logger.log(`Auto-cancel job: cancelled ${cancelledCount} unpaid booking(s) ` +
                    `(older than ${AUTO_CANCEL_HOURS}h) and notified guest(s)`);
            }
        }
        catch (err) {
            this.logger.error(`Auto-cancel job failed: ${err.message}`, err.stack);
        }
    }
    async detectNoShows() {
        const graceCutoff = new Date(Date.now() - NO_SHOW_GRACE_HOURS * 3_600_000);
        try {
            const result = await this.bookingModel.updateMany({
                status: booking_schema_1.BookingStatus.CONFIRMED,
                actualCheckIn: { $exists: false },
                checkIn: { $lt: graceCutoff },
            }, {
                $set: {
                    status: booking_schema_1.BookingStatus.NO_SHOW,
                    cancellation: {
                        cancelledBy: booking_schema_1.CancelledBy.SYSTEM,
                        cancelledAt: new Date(),
                        reason: 'Guest did not check in within grace period',
                        refundAmount: 0,
                    },
                },
            });
            if (result.modifiedCount > 0) {
                this.logger.log(`No-show job: marked ${result.modifiedCount} booking(s) as NO_SHOW`);
            }
        }
        catch (err) {
            this.logger.error(`No-show detection job failed: ${err.message}`, err.stack);
        }
    }
};
exports.BookingsScheduler = BookingsScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_HOUR),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsScheduler.prototype, "autoCancelUnpaidBookings", null);
__decorate([
    (0, schedule_1.Cron)('0 10 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BookingsScheduler.prototype, "detectNoShows", null);
exports.BookingsScheduler = BookingsScheduler = BookingsScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(booking_schema_1.Booking.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        notifications_service_1.NotificationsService])
], BookingsScheduler);
//# sourceMappingURL=bookings.scheduler.js.map