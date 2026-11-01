import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { InquiryService } from './inquiry.service';
import { InquiryController } from './inquiry.controller';
import { ComparisonService } from './comparison.service';
import { ComparisonController } from './comparison.controller';
import { Property, PropertySchema } from './schemas/property.schema';
import { Inquiry, InquirySchema } from './schemas/inquiry.schema';
import { Comparison, ComparisonSchema } from './schemas/comparison.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { HistoryModule } from '../history/history.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UserInteractionsModule } from '../user-interactions/user-interactions.module';
import { WatermarkService } from 'src/watermark/watermark.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Property.name, schema: PropertySchema },
      { name: Inquiry.name, schema: InquirySchema },
      { name: Comparison.name, schema: ComparisonSchema },
      { name: User.name, schema: UserSchema },
    ]),
    HistoryModule,
    NotificationsModule,
    UserInteractionsModule,
  ],
  controllers: [PropertiesController, InquiryController, ComparisonController],
  providers: [PropertiesService, InquiryService, ComparisonService, WatermarkService],
  exports: [PropertiesService, InquiryService, ComparisonService],
})
export class PropertiesModule {}
