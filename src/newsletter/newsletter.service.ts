import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Newsletter, NewsletterDocument } from './schemas/newsletter.schema';
import { SubscribeNewsletterDto } from './dto/newsletter.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @InjectModel(Newsletter.name) private newsletterModel: Model<NewsletterDocument>,
    private readonly emailService: EmailService,
  ) {}

  async subscribe(dto: SubscribeNewsletterDto): Promise<{ message: string }> {
    const existing = await this.newsletterModel.findOne({ email: dto.email });

    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('This email is already subscribed.');
      }
      // Re-activate if they previously unsubscribed
      existing.isActive = true;
      await existing.save();
    } else {
      await this.newsletterModel.create({ email: dto.email });
    }

    // Send welcome email (fire and forget)
    this.emailService.sendNewsletterWelcome(dto.email).catch((err) =>
      this.logger.error(`Failed to send newsletter welcome: ${err.message}`),
    );

    return { message: 'Successfully subscribed to the newsletter!' };
  }

  async unsubscribe(email: string): Promise<{ message: string }> {
    await this.newsletterModel.updateOne({ email }, { isActive: false });
    return { message: 'Successfully unsubscribed.' };
  }
}