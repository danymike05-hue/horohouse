import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Booking, BookingSchema } from './schema/booking.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingsScheduler } from './bookings.scheduler';
import { RoomsModule } from '../rooms/rooms.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Booking.name, schema: BookingSchema },
      // Re-import Property & User so the service can query them directly
      { name: Property.name, schema: PropertySchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => RoomsModule),
    forwardRef(() => PaymentsModule),
    NotificationsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingsScheduler],
  exports: [BookingsService],
})
export class BookingsModule { }
