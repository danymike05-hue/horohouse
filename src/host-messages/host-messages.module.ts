import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  HostMessageDelivery,
  HostMessageDeliverySchema,
  HostMessageTemplate,
  HostMessageTemplateSchema,
} from './schemas/host-message.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { HostMessagesController } from './host-messages.controller';
import { HostMessagesService } from './host-messages.service';
import { HostMessagesScheduler } from './host-messages.scheduler';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HostMessageTemplate.name, schema: HostMessageTemplateSchema },
      { name: HostMessageDelivery.name, schema: HostMessageDeliverySchema },
      { name: Property.name, schema: PropertySchema },
      { name: Booking.name, schema: BookingSchema },
      { name: User.name, schema: UserSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [HostMessagesController],
  providers: [HostMessagesService, HostMessagesScheduler],
  exports: [HostMessagesService],
})
export class HostMessagesModule {}
