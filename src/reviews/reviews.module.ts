import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsScheduler } from './reviews.scheduler';
import { Review, ReviewSchema } from './schemas/review.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { DigitalLease, DigitalLeaseSchema } from '../digital-lease/schemas/digital-lease.schema';
import { Room, RoomSchema } from '../rooms/schemas/room.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Review.name, schema: ReviewSchema },
      { name: Property.name, schema: PropertySchema },
      { name: User.name, schema: UserSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Appointment.name, schema: AppointmentSchema },
      { name: DigitalLease.name, schema: DigitalLeaseSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService, ReviewsScheduler],
  exports: [ReviewsService],
})
export class ReviewsModule {}
