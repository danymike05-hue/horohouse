import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// Schemas
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';
import { SubscriptionPlanModel, SubscriptionPlanSchema } from './schemas/subscription-plan.schema';
import { ListingBoost, ListingBoostSchema } from './schemas/listing-boost.schema';
import { Wallet, WalletSchema } from './schemas/wallet.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema'; // ← ADDED

// Services
import { PaymentsService } from './services/payments.service';
import { CamerPayService } from './services/camerpay.service';
import { SubscriptionsService } from './services/subscriptions.service';
import { ListingBoostService } from './services/listing-boost.service';
import { WalletService } from './services/wallet.service';
import { RevenueAnalyticsService } from './services/revenue-analytics.service';

// Controllers
import { PaymentsController } from './controllers/payments.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';
import { ListingBoostController } from './controllers/listing-boost.controller';
import { WalletController } from './controllers/wallet.controller';
import { RevenueAnalyticsController } from './controllers/revenue-analytics.controller';
import { User, UserSchema } from 'src/users/schemas/user.schema';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { PaymentsScheduler } from 'src/bookings/payments.scheduler';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionPlanModel.name, schema: SubscriptionPlanSchema },
      { name: ListingBoost.name, schema: ListingBoostSchema },
      { name: Wallet.name, schema: WalletSchema },
      { name: Property.name, schema: PropertySchema },
      { name: Booking.name, schema: BookingSchema },
      { name: User.name, schema: UserSchema },

    ]),
    NotificationsModule,
  ],
  controllers: [
    PaymentsController,
    SubscriptionsController,
    ListingBoostController,
    WalletController,
    RevenueAnalyticsController,
  ],
  providers: [
    PaymentsService,
    CamerPayService,
    SubscriptionsService,
    ListingBoostService,
    WalletService,
    RevenueAnalyticsService,
    PaymentsScheduler,
  ],
  exports: [
    PaymentsService,
    CamerPayService,
    SubscriptionsService,
    ListingBoostService,
    WalletService,
    RevenueAnalyticsService,
    PaymentsScheduler
  ],
})
export class PaymentsModule { }