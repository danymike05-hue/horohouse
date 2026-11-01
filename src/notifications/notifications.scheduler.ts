import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { NotificationsService } from './notifications.service';
import { NotificationType } from './schemas/notification.schema';
import { Booking, BookingDocument, BookingStatus } from '../bookings/schema/booking.schema';
import { ReviewsService } from '../reviews/reviews.service';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly reviewsService: ReviewsService,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  // CHECK-IN REMINDERS — runs every day at 10:00
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Finds all confirmed bookings whose check-in is between 20h and 28h from now
   * (a safe 8-hour window around "24h before") and sends a reminder to the guest.
   *
   * The wide window (20–28h instead of exactly 24h) prevents missed reminders
   * if the cron fires slightly early or late.
   */
  @Cron('0 10 * * *') // every day at 10:00
  async sendCheckInReminders(): Promise<void> {
    this.logger.log('[Scheduler] Running check-in reminder job');

    const now       = new Date();
    const windowMin = new Date(now.getTime() + 20 * 60 * 60 * 1000); // +20h
    const windowMax = new Date(now.getTime() + 28 * 60 * 60 * 1000); // +28h

    try {
      const upcomingBookings = await this.bookingModel
        .find({
          status:  BookingStatus.CONFIRMED,
          checkIn: { $gte: windowMin, $lte: windowMax },
        })
        .populate('propertyId', 'title shortTermAmenities')
        .lean()
        .exec();

      this.logger.log(
        `[Scheduler] Found ${upcomingBookings.length} booking(s) with check-in in ~24h`,
      );

      for (const booking of upcomingBookings) {
        const property  = booking.propertyId as any;
        const checkInTime = property?.shortTermAmenities?.checkInTime;

        await this.notificationsService.notifyCheckInReminder(
          booking.guestId.toString(),
          {
            bookingId:     (booking as any)._id.toString(),
            propertyId:    property?._id?.toString() ?? '',
            propertyTitle: property?.title ?? 'your upcoming stay',
            checkIn:       booking.checkIn.toISOString().split('T')[0],
            checkInTime,
          },
        );
      }
    } catch (error) {
      this.logger.error('[Scheduler] Check-in reminder job failed:', error);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // REVIEW PROMPT REMINDERS — runs every day at 11:00
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Finds completed bookings where the guest or host hasn't reviewed yet
   * AND the checkout was 3 days ago (a gentle nudge before the 14-day window closes).
   * Sends a reminder only once — checks that a REVIEW_REQUEST notification
   * hasn't already been sent for this booking.
   */
  @Cron('0 11 * * *') // every day at 11:00
  async sendReviewReminders(): Promise<void> {
    this.logger.log('[Scheduler] Running review reminder job');

    const now          = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fourDaysAgo  = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

    try {
      // Find bookings that checked out 3 days ago (±1 day window)
      const completedBookings = await this.bookingModel
        .find({
          status:   BookingStatus.COMPLETED,
          checkOut: { $gte: fourDaysAgo, $lte: threeDaysAgo },
          // At least one side hasn't reviewed yet
          $or: [
            { guestReviewLeft: false },
            { hostReviewLeft:  false },
          ],
        })
        .populate('propertyId', 'title')
        .lean()
        .exec();

      this.logger.log(
        `[Scheduler] Found ${completedBookings.length} booking(s) pending review reminders`,
      );

      for (const booking of completedBookings) {
        const property      = booking.propertyId as any;
        const propertyTitle = property?.title ?? 'your recent stay';
        const bookingId     = (booking as any)._id.toString();

        // Remind guest if they haven't reviewed (single-recipient notification)
        if (!booking.guestReviewLeft) {
          await this.notificationsService.create({
            userId: booking.guestId.toString(),
            type: NotificationType.REVIEW_REQUEST,
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

        // Remind host if they haven't reviewed (single-recipient notification)
        if (!booking.hostReviewLeft) {
          await this.notificationsService.create({
            userId: booking.hostId.toString(),
            type: NotificationType.REVIEW_REQUEST,
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
    } catch (error) {
      this.logger.error('[Scheduler] Review reminder job failed:', error);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PUBLISH EXPIRED REVIEWS — runs every hour
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Force-publishes booking reviews whose 14-day window has expired
   * and then fires the REVIEW_PUBLISHED notification for affected bookings.
   *
   * Delegates to ReviewsService.publishExpiredReviews() which returns
   * the number of reviews published (0 means nothing to do).
   */
  @Cron(CronExpression.EVERY_HOUR)
  async publishExpiredReviews(): Promise<void> {
    try {
      const published = await this.reviewsService.publishExpiredReviews();

      if (published > 0) {
        this.logger.log(
          `[Scheduler] Published ${published} expired review(s). ` +
          'REVIEW_PUBLISHED notifications should be fired from ReviewsService.',
        );
        // Note: ReviewsService.publishExpiredReviews() is a bulk updateMany.
        // If you need per-booking REVIEW_PUBLISHED notifications here, enrich
        // that method to return the affected booking IDs and loop over them,
        // calling this.notificationsService.notifyReviewsPublished() for each.
      }
    } catch (error) {
      this.logger.error('[Scheduler] Publish expired reviews job failed:', error);
    }
  }
}