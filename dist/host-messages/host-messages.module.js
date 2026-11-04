"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostMessagesModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const host_message_schema_1 = require("./schemas/host-message.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const notifications_module_1 = require("../notifications/notifications.module");
const host_messages_controller_1 = require("./host-messages.controller");
const host_messages_service_1 = require("./host-messages.service");
const host_messages_scheduler_1 = require("./host-messages.scheduler");
let HostMessagesModule = class HostMessagesModule {
};
exports.HostMessagesModule = HostMessagesModule;
exports.HostMessagesModule = HostMessagesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: host_message_schema_1.HostMessageTemplate.name, schema: host_message_schema_1.HostMessageTemplateSchema },
                { name: host_message_schema_1.HostMessageDelivery.name, schema: host_message_schema_1.HostMessageDeliverySchema },
                { name: property_schema_1.Property.name, schema: property_schema_1.PropertySchema },
                { name: booking_schema_1.Booking.name, schema: booking_schema_1.BookingSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
            ]),
            notifications_module_1.NotificationsModule,
        ],
        controllers: [host_messages_controller_1.HostMessagesController],
        providers: [host_messages_service_1.HostMessagesService, host_messages_scheduler_1.HostMessagesScheduler],
        exports: [host_messages_service_1.HostMessagesService],
    })
], HostMessagesModule);
//# sourceMappingURL=host-messages.module.js.map