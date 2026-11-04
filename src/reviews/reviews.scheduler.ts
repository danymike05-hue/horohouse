import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReviewsService } from './reviews.service';

/**
 * Booking reviews stay hidden until both sides have written one. If only one side does,
 * it goes public when the 14-day window ends. Nothing called publishExpiredReviews()
 * before, so those reviews stayed hidden for ever.
 */
@Injectable()
export class ReviewsScheduler {
  private readonly logger = new Logger(ReviewsScheduler.name);

  constructor(private readonly reviewsService: ReviewsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async publishExpired(): Promise<void> {
    try {
      await this.reviewsService.publishExpiredReviews();
    } catch (err: any) {
      this.logger.error(`publishExpiredReviews failed: ${err?.message}`);
    }
  }
}
