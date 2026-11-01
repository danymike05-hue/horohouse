import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';

// Modules
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PropertiesModule } from './properties/properties.module';
import { HistoryModule } from './history/history.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { EmailModule } from './email/email.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SavedSearchesModule } from './saved-searches/saved-searches.module';
import { ReviewsModule } from './reviews/reviews.module';
import { UserInteractionsModule } from './user-interactions/user-interactions.module';
import { RecommendationModule } from './recommendations/recommendation.module';
import { PaymentsModule } from './payments/payments.module';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { ChatModule } from './chat/chat.module';
import { LeadsModule } from './leads/leads.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { SystemSettingsModule } from './system-settings/system-settings.module';
import { BookingsModule } from './bookings/bookings.module';
import { ReportsModule } from './reports/reports.module';
import { RoomsModule } from './rooms/rooms.module';
import { StudentProfilesModule } from './student-profiles/student-profiles.module';
import { StudentPropertiesModule } from './student-properties/student-properties.module';
import { SplitPaymentsModule } from './split-payments/split-payments.module';
import { DigitalLeaseModule } from './digital-lease/digital-lease.module';
import { RoommateMatchingModule } from './roommate/roommate.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { InsightsModule } from './insights/insights.module';
import { CommunityModule } from './community/community.module';
import { DevicesModule } from './devices/devices.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
        // Connection pool — critical for concurrent request performance
        maxPoolSize: 50,
        minPoolSize: 5,
        // Timeout tuning
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        // Reduce wire traffic on slower connections
        compressors: ['zlib'],
      }),
      inject: [ConfigService],
    }),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => [
        {
          name: 'default',
          ttl: 60 * 1000,
          limit: 100,
        },
        {
          name: 'notifications',
          ttl: 60 * 1000,
          limit: 200,
        },
      ],
      inject: [ConfigService],
    }),

    // Feature Modules
    AuthModule,
    UsersModule,
    PropertiesModule,
    HistoryModule,
    AnalyticsModule,
    CloudinaryModule,
    EmailModule,
    OnboardingModule,
    NotificationsModule,
    SavedSearchesModule,
    ReviewsModule,
    UserInteractionsModule,
    RecommendationModule,
    PaymentsModule,
    AiChatModule,
    ChatModule,
    LeadsModule,
    AppointmentsModule,
    SystemSettingsModule,
    BookingsModule,
    ReportsModule,
    RoomsModule,
    StudentProfilesModule,
    StudentPropertiesModule,
    SplitPaymentsModule,
    DigitalLeaseModule,
    RoommateMatchingModule,
    NewsletterModule,
    InsightsModule,
    CommunityModule,
    DevicesModule,
  ],

  controllers: [AppController],
  providers: [
    AppService,
    // Fixed: was returning the class itself instead of instantiating it,
    // which silently broke throttling in production.
    // ThrottlerGuard works in both envs — it's a no-op cost in dev.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}