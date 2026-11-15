import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LanguagesController } from './languages.controller';
import { LanguagesService } from './languages.service';
import {
  LanguageCourse, LanguageCourseSchema, LanguageMemory, LanguageMemorySchema, LanguageProfile, LanguageProfileSchema,
} from './schemas/language.schemas';
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
    ]),
    NotificationsModule,
  ],
  controllers: [LanguagesController],
  providers: [LanguagesService],
})
export class LanguagesModule {}
