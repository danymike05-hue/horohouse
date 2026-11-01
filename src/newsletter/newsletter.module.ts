import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Newsletter, NewsletterSchema } from './schemas/newsletter.schema';
import { NewsletterController } from './newsletter.controller';
import { NewsletterService } from './newsletter.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Newsletter.name, schema: NewsletterSchema }]),
    EmailModule,
  ],
  controllers: [NewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule {}