"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckoutModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const payments_module_1 = require("../payments/payments.module");
const transaction_schema_1 = require("../payments/schemas/transaction.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const listing_boost_schema_1 = require("../payments/schemas/listing-boost.schema");
const subscription_schema_1 = require("../payments/schemas/subscription.schema");
const wallet_schema_1 = require("../payments/schemas/wallet.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const purchase_gateway_1 = require("./purchase.gateway");
const booking_payment_gateway_1 = require("./booking-payment.gateway");
const camerpay_client_1 = require("./camerpay.client");
const checkout_expiry_job_1 = require("./checkout-expiry.job");
const checkout_controller_1 = require("./checkout.controller");
const checkout_service_1 = require("./checkout.service");
const checkout_payment_schema_1 = require("./schemas/checkout-payment.schema");
let CheckoutModule = class CheckoutModule {
};
exports.CheckoutModule = CheckoutModule;
exports.CheckoutModule = CheckoutModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: checkout_payment_schema_1.CheckoutPayment.name, schema: checkout_payment_schema_1.CheckoutPaymentSchema },
                { name: booking_schema_1.Booking.name, schema: booking_schema_1.BookingSchema },
                { name: transaction_schema_1.Transaction.name, schema: transaction_schema_1.TransactionSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
                { name: listing_boost_schema_1.ListingBoost.name, schema: listing_boost_schema_1.ListingBoostSchema },
                { name: subscription_schema_1.Subscription.name, schema: subscription_schema_1.SubscriptionSchema },
                { name: wallet_schema_1.Wallet.name, schema: wallet_schema_1.WalletSchema },
                { name: property_schema_1.Property.name, schema: property_schema_1.PropertySchema },
            ]),
            (0, common_1.forwardRef)(() => payments_module_1.PaymentsModule),
        ],
        controllers: [checkout_controller_1.CheckoutController],
        providers: [checkout_service_1.CheckoutService, camerpay_client_1.CamerPayClient, booking_payment_gateway_1.BookingPaymentGateway, purchase_gateway_1.PurchaseGateway, checkout_expiry_job_1.CheckoutExpiryJob],
        exports: [checkout_service_1.CheckoutService],
    })
], CheckoutModule);
//# sourceMappingURL=checkout.module.js.map