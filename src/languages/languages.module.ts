import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { LanguagesController } from './languages.controller';
import { LanguagesService } from './languages.service';
import { LanguageCourse, LanguageCourseSchema, LanguageProfile, LanguageProfileSchema } from './schemas/language.schemas';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: LanguageCourse.name, schema: LanguageCourseSchema },
      { name: LanguageProfile.name, schema: LanguageProfileSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [LanguagesController],
  providers: [LanguagesService],
})
export class LanguagesModule {}
