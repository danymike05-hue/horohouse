import { NewsletterService } from './newsletter.service';
import { SubscribeNewsletterDto } from './dto/newsletter.dto';
export declare class NewsletterController {
    private readonly newsletterService;
    constructor(newsletterService: NewsletterService);
    subscribe(dto: SubscribeNewsletterDto): Promise<{
        message: string;
    }>;
    unsubscribe(email: string): Promise<{
        message: string;
    }>;
}
