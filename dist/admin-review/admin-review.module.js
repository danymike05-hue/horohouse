"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminReviewModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const checkout_payment_schema_1 = require("../checkout/schemas/checkout-payment.schema");
const transaction_schema_1 = require("../payments/schemas/transaction.schema");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const admin_review_controller_1 = require("./admin-review.controller");
const admin_review_service_1 = require("./admin-review.service");
let AdminReviewModule = class AdminReviewModule {
};
exports.AdminReviewModule = AdminReviewModule;
exports.AdminReviewModule = AdminReviewModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: checkout_payment_schema_1.CheckoutPayment.name, schema: checkout_payment_schema_1.CheckoutPaymentSchema },
                { name: transaction_schema_1.Transaction.name, schema: transaction_schema_1.TransactionSchema },
                { name: booking_schema_1.Booking.name, schema: booking_schema_1.BookingSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
            ]),
        ],
        controllers: [admin_review_controller_1.AdminReviewController],
        providers: [admin_review_service_1.AdminReviewService],
    })
], AdminReviewModule);
//# sourceMappingURL=admin-review.module.js.map