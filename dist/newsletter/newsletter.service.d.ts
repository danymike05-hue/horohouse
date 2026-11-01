import { Model } from 'mongoose';
import { NewsletterDocument } from './schemas/newsletter.schema';
import { SubscribeNewsletterDto } from './dto/newsletter.dto';
import { EmailService } from '../email/email.service';
export declare class NewsletterService {
    private newsletterModel;
    private readonly emailService;
    private readonly logger;
    constructor(newsletterModel: Model<NewsletterDocument>, emailService: EmailService);
    subscribe(dto: SubscribeNewsletterDto): Promise<{
        message: string;
    }>;
    unsubscribe(email: string): Promise<{
        message: string;
    }>;
}
