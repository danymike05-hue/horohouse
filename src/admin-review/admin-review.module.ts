import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CheckoutPayment, CheckoutPaymentSchema } from '../checkout/schemas/checkout-payment.schema';
import { Transaction, TransactionSchema } from '../payments/schemas/transaction.schema';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AdminReviewController } from './admin-review.controller';
import { AdminReviewService } from './admin-review.service';

// CamerPayService and NotificationsService are reached through ModuleRef, so this
// module doesn't need to import PaymentsModule / NotificationsModule.
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CheckoutPayment.name, schema: CheckoutPaymentSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [AdminReviewController],
  providers: [AdminReviewService],
})
export class AdminReviewModule {}
