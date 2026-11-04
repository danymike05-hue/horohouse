import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HostMessagesService } from './host-messages.service';

/** Every 15 minutes: hosts' scheduled messages and "your check-in guide is ready" notices */
@Injectable()
export class HostMessagesScheduler {
  private readonly logger = new Logger(HostMessagesScheduler.name);
  private running = false;

  constructor(private readonly service: HostMessagesService) {}

  @Cron('*/15 * * * *', { name: 'host-scheduled-messages' })
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const messages = await this.service.runScheduledMessages();
      const guides = await this.service.sendCheckInGuideNotices();
      if (messages || guides) this.logger.log(`Sent ${messages} scheduled message(s), ${guides} check-in guide notice(s)`);
    } catch (err: any) {
      this.logger.error(`host-scheduled-messages failed: ${err?.message}`, err?.stack);
    } finally {
      this.running = false;
    }
  }
}
