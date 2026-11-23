import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Subscription, SubscriptionSchema } from '../payments/schemas/subscription.schema';
import { SubscriptionPlanModel, SubscriptionPlanSchema } from '../payments/schemas/subscription-plan.schema';
import { Property, PropertySchema } from '../properties/schemas/property.schema';
import { CoHost, CoHostSchema } from '../co-hosts/schemas/co-host.schema';
import { HostMessageTemplate, HostMessageTemplateSchema } from '../host-messages/schemas/host-message.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Booking, BookingSchema } from '../bookings/schema/booking.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { HostPlanCounter, HostPlanCounterSchema, HostPlanState, HostPlanStateSchema } from './schemas/host-plan-state.schema';
import { HostPlansService } from './host-plans.service';
import { HostInsightsService, ListingViewDay, ListingViewDaySchema } from './host-insights.service';
import { ListingWriterService } from './listing-writer.service';
import { PromoCode, PromoCodeSchema, PromoCodesService } from './promo-codes.service';
import { HostPlansController, PromoCodesController } from './host-plans.controller';

/**
 * Hosting plan limits and extras. Global, and it imports no feature module, so listings,
 * bookings, co-hosts, messages, payouts and chat can all use it without import cycles.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionPlanModel.name, schema: SubscriptionPlanSchema },
      { name: HostPlanState.name, schema: HostPlanStateSchema },
      { name: HostPlanCounter.name, schema: HostPlanCounterSchema },
      { name: Property.name, schema: PropertySchema },
      { name: CoHost.name, schema: CoHostSchema },
      { name: HostMessageTemplate.name, schema: HostMessageTemplateSchema },
      { name: User.name, schema: UserSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: ListingViewDay.name, schema: ListingViewDaySchema },
      { name: PromoCode.name, schema: PromoCodeSchema },
    ]),
    NotificationsModule,
  ],
  controllers: [HostPlansController, PromoCodesController],
  providers: [HostPlansService, HostInsightsService, ListingWriterService, PromoCodesService],
  exports: [HostPlansService, HostInsightsService, PromoCodesService],
})
export class HostPlansModule {}
