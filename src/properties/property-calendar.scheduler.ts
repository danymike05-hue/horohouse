import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PropertiesService } from './properties.service';

/**
 * Re-imports every connected external calendar (Airbnb, Booking.com…) each hour, so a
 * booking made elsewhere blocks the same nights here. Airbnb itself refreshes imported
 * calendars about every few hours, so hourly is plenty and polite to their servers.
 */
@Injectable()
export class PropertyCalendarScheduler {
  private readonly logger = new Logger(PropertyCalendarScheduler.name);
  private running = false;

  constructor(private readonly propertiesService: PropertiesService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'sync-external-calendars' })
  async syncExternalCalendars(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.propertiesService.syncAllExternalCalendars();
      if (n) this.logger.log(`Synced ${n} external calendar(s)`);
    } catch (err: any) {
      this.logger.error(`sync-external-calendars failed: ${err?.message}`, err?.stack);
    } finally {
      this.running = false;
    }
  }
}
