"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigitalLeaseModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const config_1 = require("@nestjs/config");
const digital_lease_service_1 = require("./digital-lease.service");
const digital_lease_controller_1 = require("./digital-lease.controller");
const digital_lease_schema_1 = require("./schemas/digital-lease.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const notifications_module_1 = require("../notifications/notifications.module");
const split_payments_module_1 = require("../split-payments/split-payments.module");
let DigitalLeaseModule = class DigitalLeaseModule {
};
exports.DigitalLeaseModule = DigitalLeaseModule;
exports.DigitalLeaseModule = DigitalLeaseModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: digital_lease_schema_1.DigitalLease.name, schema: digital_lease_schema_1.DigitalLeaseSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
                { name: property_schema_1.Property.name, schema: property_schema_1.PropertySchema },
            ]),
            config_1.ConfigModule,
            notifications_module_1.NotificationsModule,
            split_payments_module_1.SplitPaymentsModule,
        ],
        controllers: [digital_lease_controller_1.DigitalLeaseController],
        providers: [digital_lease_service_1.DigitalLeaseService],
        exports: [digital_lease_service_1.DigitalLeaseService],
    })
], DigitalLeaseModule);
//# sourceMappingURL=digital-lease.module.js.map