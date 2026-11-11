import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BookingsService } from './bookings.service';

/**
 * Releases dates held by unpaid bookings once their deadline passes
 * (instant-book: 30 min to pay · request: 48 h for the host · accepted: 24 h to pay).
 *
 * Register it in BookingsModule: providers: [BookingsService, BookingsScheduler]
 */
@Injectable()
export class BookingsScheduler {
  private readonly logger = new Logger(BookingsScheduler.name);
  private running = false;

  constructor(private readonly bookingsService: BookingsService) { }

  @Cron(CronExpression.EVERY_5_MINUTES, { name: 'expire-unpaid-bookings' })
  async expireUnpaidBookings(): Promise<void> {
    if (this.running) return; // a slow run must not overlap the next one
    this.running = true;
    try {
      // Drain in batches so a backlog (e.g. after downtime) clears in one run.
      let total = 0;
      for (let i = 0; i < 10; i++) {
        const n = await this.bookingsService.expireOverdueBookings(200);
        total += n;
        if (n < 200) break;
      }
      if (total) this.logger.log(`Released ${total} unpaid booking(s)`);
    } catch (err: any) {
      this.logger.error(`expire-unpaid-bookings failed: ${err?.message}`, err?.stack);
    } finally {
      this.running = false;
    }
  }

  /** Paid stays whose checkout has passed become COMPLETED (sends the review prompts). */
  @Cron(CronExpression.EVERY_HOUR, { name: 'complete-finished-stays' })
  async completeFinishedStays(): Promise<void> {
    try {
      const n = await this.bookingsService.completeFinishedStays(200);
      if (n) this.logger.log(`Completed ${n} finished stay(s)`);
    } catch (err: any) {
      this.logger.error(`complete-finished-stays failed: ${err?.message}`, err?.stack);
    }
  }
}
