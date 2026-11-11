import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { CoHostsModule } from '../co-hosts/co-hosts.module';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { BookingChangesController } from './booking-changes.controller';
import { BookingChangesService } from './booking-changes.service';
import { BookingDateChange, BookingDateChangeSchema } from './schemas/booking-date-change.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookingDateChange.name, schema: BookingDateChangeSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
    BookingsModule,
    PaymentsModule,
    NotificationsModule,
    CoHostsModule,
  ],
  controllers: [BookingChangesController],
  providers: [BookingChangesService],
  exports: [BookingChangesService],
})
export class BookingChangesModule {}
