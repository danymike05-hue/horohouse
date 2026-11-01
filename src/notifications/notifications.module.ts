import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { PushNotificationsService } from './push-notifications.service';   // ← add
import { Notification, NotificationSchema } from './schemas/notification.schema';
import { User, UserSchema } from '../users/schemas/user.schema';           // ← add
import { DevicesModule } from '../devices/devices.module';                 // ← add
import { EmailModule } from '../email/email.module';                       // ← add

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: User.name, schema: UserSchema },   // ← add — PushNotificationsService injects this
    ]),
    DevicesModule,   // ← add — provides DevicesService that PushNotificationsService needs
    EmailModule,     // ← add — provides EmailService for admin notification emails
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
    PushNotificationsService,   // ← add — this is what the error was actually about
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    PushNotificationsService,   // ← exported so ChatGateway can inject it
  ],
})
export class NotificationsModule {}