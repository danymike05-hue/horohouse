import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';

import { Booking, BookingDocument, BookingStatus, PaymentStatus, CancelledBy } from './schema/booking.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

/** Hours after creation that an unpaid PENDING booking is auto-cancelled */
const AUTO_CANCEL_HOURS = 24;

/** Hours after check-in time with no actualCheckIn before marking NO_SHOW */
const NO_SHOW_GRACE_HOURS = 24;

@Injectable()
export class BookingsScheduler {
    private readonly logger = new Logger(BookingsScheduler.name);

    constructor(
        @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
        private readonly notificationsService: NotificationsService,
    ) { }

    // ════════════════════════════════════════════════════════════════════════════
    // AUTO-CANCEL UNPAID BOOKINGS
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Every hour: find PENDING bookings that have been waiting more than
     * AUTO_CANCEL_HOURS without payment and cancel them automatically.
     * Frees up the calendar for other guests and notifies each guest
     * via in-app + push notification.
     */
    @Cron(CronExpression.EVERY_HOUR)
    async autoCancelUnpaidBookings(): Promise<void> {
        const cutoff = new Date(Date.now() - AUTO_CANCEL_HOURS * 3_600_000);

        try {
            // Fetch individually (not updateMany) so we can notify each guest
            const expiredBookings = await this.bookingModel
                .find({
                    paymentStatus: PaymentStatus.UNPAID,
                    $or: [
                        // Instant-book or awaiting host response — never paid, created too long ago
                        { status: BookingStatus.PENDING, createdAt: { $lt: cutoff } },
                        // Host confirmed, but guest never paid within the window
                        { status: BookingStatus.CONFIRMED, confirmedAt: { $lt: cutoff } },
                    ],
                })
                .populate('propertyId', 'title')
                .lean()
                .exec();

            if (expiredBookings.length === 0) return;

            let cancelledCount = 0;

            for (const booking of expiredBookings) {
                try {
                    const wasConfirmed = booking.status === BookingStatus.CONFIRMED;
                    const reason = wasConfirmed
                        ? `Automatically cancelled: payment not received within ${AUTO_CANCEL_HOURS} hours of host confirmation`
                        : `Automatically cancelled: payment not received within ${AUTO_CANCEL_HOURS} hours`;

                    // ── 1. Mark booking as CANCELLED ─────────────────────────────
                    await this.bookingModel.findByIdAndUpdate(booking._id, {
                        $set: {
                            status: BookingStatus.CANCELLED,
                            cancellation: {
                                cancelledBy: CancelledBy.SYSTEM,
                                cancelledAt: new Date(),
                                reason,
                                refundAmount: 0,
                            },
                        },
                    });

                    // Once status = CANCELLED, assertDatesAvailable() will no longer
                    // include this booking — the dates are immediately free again.

                    // ── 2. Notify the guest (in-app + push) ──────────────────────
                    const propertyTitle = (booking.propertyId as any)?.title ?? 'the property';
                    const fmt = (d: Date) => new Date(d).toISOString().split('T')[0];
                    const checkIn  = fmt(booking.checkIn);
                    const checkOut = fmt(booking.checkOut);

                    await this.notificationsService.create({
                        userId: booking.guestId.toString(),
                        type:   NotificationType.BOOKING_CANCELLED,
                        title:  'Booking cancelled — payment timeout ⏰',
                        message:
                            `Your reservation at ${propertyTitle} ` +
                            `(${checkIn} → ${checkOut}) was automatically cancelled ` +
                            `because payment was not completed within ${AUTO_CANCEL_HOURS} hours. ` +
                            `The dates are now available for other guests.`,
                        link: `/bookings/${booking._id.toString()}`,
                        metadata: {
                            bookingId:     booking._id.toString(),
                            propertyId:    (booking.propertyId as any)?._id?.toString() ?? booking.propertyId?.toString(),
                            propertyTitle,
                            checkIn,
                            checkOut,
                        },
                    });

                    cancelledCount++;
                } catch (bookingErr: any) {
                    this.logger.warn(
                        `Auto-cancel: failed to process booking ${booking._id}: ${bookingErr.message}`,
                    );
                }
            }

            if (cancelledCount > 0) {
                this.logger.log(
                    `Auto-cancel job: cancelled ${cancelledCount} unpaid booking(s) ` +
                    `(older than ${AUTO_CANCEL_HOURS}h) and notified guest(s)`,
                );
            }
        } catch (err: any) {
            this.logger.error(`Auto-cancel job failed: ${err.message}`, err.stack);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // AUTO NO-SHOW DETECTION
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Daily at 10:00: find CONFIRMED bookings whose check-in date passed more
     * than NO_SHOW_GRACE_HOURS ago with no actualCheckIn recorded.
     * Marks them as NO_SHOW, which triggers the no-refund path.
     */
    @Cron('0 10 * * *') // Every day at 10:00 AM
    async detectNoShows(): Promise<void> {
        const graceCutoff = new Date(Date.now() - NO_SHOW_GRACE_HOURS * 3_600_000);

        try {
            const result = await this.bookingModel.updateMany(
                {
                    status: BookingStatus.CONFIRMED,
                    actualCheckIn: { $exists: false },
                    checkIn: { $lt: graceCutoff },
                },
                {
                    $set: {
                        status: BookingStatus.NO_SHOW,
                        cancellation: {
                            cancelledBy: CancelledBy.SYSTEM,
                            cancelledAt: new Date(),
                            reason: 'Guest did not check in within grace period',
                            refundAmount: 0,
                        },
                    },
                },
            );

            if (result.modifiedCount > 0) {
                this.logger.log(
                    `No-show job: marked ${result.modifiedCount} booking(s) as NO_SHOW`,
                );
            }
        } catch (err: any) {
            this.logger.error(`No-show detection job failed: ${err.message}`, err.stack);
        }
    }
}
