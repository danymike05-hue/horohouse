import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LanguagesController } from './languages.controller';
import { LanguagesService } from './languages.service';
import {
  LanguageCourse, LanguageCourseSchema, LanguageFollow, LanguageFollowSchema, LanguageMemory, LanguageMemorySchema,
  LanguageProfile, LanguageProfileSchema,
} from './schemas/language.schemas';
import { Subscription, SubscriptionSchema } from '../payments/schemas/subscription.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: LanguageCourse.name, schema: LanguageCourseSchema },
      { name: LanguageProfile.name, schema: LanguageProfileSchema },
      { name: LanguageMemory.name, schema: LanguageMemorySchema },
      // Leagues: learners' names and campus
      { name: User.name, schema: UserSchema },
      { name: LanguageFollow.name, schema: LanguageFollowSchema },
      // Read-only: an active plan means unlimited lives
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [LanguagesController],
  providers: [LanguagesService],
})
export class LanguagesModule {}
