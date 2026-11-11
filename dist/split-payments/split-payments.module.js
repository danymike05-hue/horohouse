"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SplitPaymentsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const split_payments_service_1 = require("./split-payments.service");
const split_payments_controller_1 = require("./split-payments.controller");
const split_payment_schema_1 = require("./schemas/split-payment.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const notifications_module_1 = require("../notifications/notifications.module");
const payments_module_1 = require("../payments/payments.module");
let SplitPaymentsModule = class SplitPaymentsModule {
};
exports.SplitPaymentsModule = SplitPaymentsModule;
exports.SplitPaymentsModule = SplitPaymentsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: split_payment_schema_1.SplitPayment.name, schema: split_payment_schema_1.SplitPaymentSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
            ]),
            notifications_module_1.NotificationsModule,
            payments_module_1.PaymentsModule,
        ],
        controllers: [split_payments_controller_1.SplitPaymentsController],
        providers: [split_payments_service_1.SplitPaymentsService],
        exports: [split_payments_service_1.SplitPaymentsService],
    })
], SplitPaymentsModule);
//# sourceMappingURL=split-payments.module.js.map