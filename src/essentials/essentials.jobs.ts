import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EssentialsService } from './essentials.service';

/** Unpaid orders expire, shops are chased to accept, held money is released after delivery */
@Injectable()
export class EssentialsJobs {
  private readonly logger = new Logger(EssentialsJobs.name);
  private running = false;

  constructor(private readonly ess: EssentialsService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'essentials-orders' })
  async run(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.ess.expireUnpaid();
      await this.ess.chaseShops();
      const released = await this.ess.releaseHeld();
      if (released) this.logger.log(`Released ${released} order(s) for payout`);
    } catch (err: any) {
      this.logger.error(`Essentials job failed: ${err?.message ?? err}`);
    } finally {
      this.running = false;
    }
  }
}
