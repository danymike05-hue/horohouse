import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { PushNotificationsService } from './push-notifications.service';
import { ListingNudgeScheduler } from './listing-nudge.scheduler';
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema';
import { DevicesModule } from '../devices/devices.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },
      // Listing photo on pushes + the "homes are going fast" reminder
      { name: Property.name, schema: PropertySchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
    DevicesModule,
    EmailModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN', '15m');
        let expiresInSeconds: number;

        if (expiresIn.endsWith('d')) {
          expiresInSeconds = parseInt(expiresIn) * 24 * 60 * 60;
        } else if (expiresIn.endsWith('h')) {
          expiresInSeconds = parseInt(expiresIn) * 60 * 60;
        } else if (expiresIn.endsWith('m')) {
          expiresInSeconds = parseInt(expiresIn) * 60;
        } else if (expiresIn.endsWith('s')) {
          expiresInSeconds = parseInt(expiresIn);
        } else {
          expiresInSeconds = parseInt(expiresIn) || 900;
        }

        return {
          secret: configService.get<string>('JWT_SECRET'),
          signOptions: { expiresIn: expiresInSeconds },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    PushNotificationsService,
    ListingNudgeScheduler,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    PushNotificationsService,
  ],
})
export class NotificationsModule {}
