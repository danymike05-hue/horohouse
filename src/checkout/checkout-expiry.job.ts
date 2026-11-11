import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CheckoutService } from './checkout.service';

@Injectable()
export class CheckoutExpiryJob {
  private readonly logger = new Logger(CheckoutExpiryJob.name);
  private running = false;

  constructor(private readonly checkout: CheckoutService) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'checkout-expiry' })
  async run(): Promise<void> {
    if (this.running) return; // skip if the previous run is still going
    this.running = true;
    try {
      await this.checkout.expireOverdue();
    } catch (err: any) {
      this.logger.error(`Expiry job failed: ${err?.message ?? err}`);
    } finally {
      this.running = false;
    }
  }
}
