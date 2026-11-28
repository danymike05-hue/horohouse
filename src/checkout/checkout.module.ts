import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema';
import { PaymentsModule } from '../payments/payments.module';
import { BookingChangesModule } from '../booking-changes/booking-changes.module';
import { Transaction, TransactionSchema } from '../payments/schemas/transaction.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { ListingBoost, ListingBoostSchema } from '../payments/schemas/listing-boost.schema';
import { Subscription, SubscriptionSchema } from '../payments/schemas/subscription.schema';
import { Wallet, WalletSchema } from '../payments/schemas/wallet.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { SplitPaymentsModule } from '../split-payments/split-payments.module';
import { EssentialsModule } from '../essentials/essentials.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PurchaseGateway } from './purchase.gateway';
import { BookingPaymentGateway } from './booking-payment.gateway';
import { CamerPayClient } from './camerpay.client';
import { CheckoutExpiryJob } from './checkout-expiry.job';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutPayment, CheckoutPaymentSchema } from './schemas/checkout-payment.schema';
import { StoreVerifyService } from './store-verify.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CheckoutPayment.name, schema: CheckoutPaymentSchema },
      // Same models BookingsModule / PaymentsModule register — re-declaring is safe.
      { name: Booking.name, schema: BookingSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: User.name, schema: UserSchema },
      // Subscriptions / boosts / wallet payments (also registered by PaymentsModule)
      { name: ListingBoost.name, schema: ListingBoostSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: Property.name, schema: PropertySchema },
    ]),
    forwardRef(() => BookingChangesModule),
    EssentialsModule,
    // Shared rent: tenants pay their share through checkout
    SplitPaymentsModule,
    forwardRef(() => PaymentsModule), // must export PaymentsService (BookingsModule already relies on it)
    // Calendar holds: hold the dates while paying, free them when a payment fails
    forwardRef(() => BookingsModule),
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService, CamerPayClient, BookingPaymentGateway, PurchaseGateway, CheckoutExpiryJob, StoreVerifyService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
