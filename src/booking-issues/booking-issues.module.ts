import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { CoHostsModule } from '../co-hosts/co-hosts.module';
import { BookingIssuesController } from './booking-issues.controller';
import { BookingIssuesService } from './booking-issues.service';
import { BookingIssue, BookingIssueSchema } from './schemas/booking-issue.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BookingIssue.name, schema: BookingIssueSchema },
      { name: Booking.name, schema: BookingSchema },
    ]),
    PaymentsModule,
    NotificationsModule,
    CoHostsModule,
  ],
  controllers: [BookingIssuesController],
  providers: [BookingIssuesService],
})
export class BookingIssuesModule {}
