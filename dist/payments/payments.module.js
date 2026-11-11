"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const transaction_schema_1 = require("./schemas/transaction.schema");
const subscription_schema_1 = require("./schemas/subscription.schema");
const subscription_plan_schema_1 = require("./schemas/subscription-plan.schema");
const listing_boost_schema_1 = require("./schemas/listing-boost.schema");
const wallet_schema_1 = require("./schemas/wallet.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const payments_service_1 = require("./services/payments.service");
const camerpay_service_1 = require("./services/camerpay.service");
const subscriptions_service_1 = require("./services/subscriptions.service");
const listing_boost_service_1 = require("./services/listing-boost.service");
const wallet_service_1 = require("./services/wallet.service");
const revenue_analytics_service_1 = require("./services/revenue-analytics.service");
const payments_controller_1 = require("./controllers/payments.controller");
const subscriptions_controller_1 = require("./controllers/subscriptions.controller");
const listing_boost_controller_1 = require("./controllers/listing-boost.controller");
const wallet_controller_1 = require("./controllers/wallet.controller");
const revenue_analytics_controller_1 = require("./controllers/revenue-analytics.controller");
const user_schema_1 = require("../users/schemas/user.schema");
const notifications_module_1 = require("../notifications/notifications.module");
const payments_scheduler_1 = require("../bookings/payments.scheduler");
let PaymentsModule = class PaymentsModule {
};
exports.PaymentsModule = PaymentsModule;
exports.PaymentsModule = PaymentsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            schedule_1.ScheduleModule.forRoot(),
            mongoose_1.MongooseModule.forFeature([
                { name: transaction_schema_1.Transaction.name, schema: transaction_schema_1.TransactionSchema },
                { name: subscription_schema_1.Subscription.name, schema: subscription_schema_1.SubscriptionSchema },
                { name: subscription_plan_schema_1.SubscriptionPlanModel.name, schema: subscription_plan_schema_1.SubscriptionPlanSchema },
                { name: listing_boost_schema_1.ListingBoost.name, schema: listing_boost_schema_1.ListingBoostSchema },
                { name: wallet_schema_1.Wallet.name, schema: wallet_schema_1.WalletSchema },
                { name: property_schema_1.Property.name, schema: property_schema_1.PropertySchema },
                { name: booking_schema_1.Booking.name, schema: booking_schema_1.BookingSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
            ]),
            notifications_module_1.NotificationsModule,
        ],
        controllers: [
            payments_controller_1.PaymentsController,
            subscriptions_controller_1.SubscriptionsController,
            listing_boost_controller_1.ListingBoostController,
            wallet_controller_1.WalletController,
            revenue_analytics_controller_1.RevenueAnalyticsController,
        ],
        providers: [
            payments_service_1.PaymentsService,
            camerpay_service_1.CamerPayService,
            subscriptions_service_1.SubscriptionsService,
            listing_boost_service_1.ListingBoostService,
            wallet_service_1.WalletService,
            revenue_analytics_service_1.RevenueAnalyticsService,
            payments_scheduler_1.PaymentsScheduler,
        ],
        exports: [
            payments_service_1.PaymentsService,
            camerpay_service_1.CamerPayService,
            subscriptions_service_1.SubscriptionsService,
            listing_boost_service_1.ListingBoostService,
            wallet_service_1.WalletService,
            revenue_analytics_service_1.RevenueAnalyticsService,
            payments_scheduler_1.PaymentsScheduler
        ],
    })
], PaymentsModule);
//# sourceMappingURL=payments.module.js.map