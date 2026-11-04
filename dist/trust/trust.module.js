"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const user_schema_1 = require("../users/schemas/user.schema");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const review_schema_1 = require("../reviews/schemas/review.schema");
const notifications_module_1 = require("../notifications/notifications.module");
const trust_controller_1 = require("./trust.controller");
const trust_service_1 = require("./trust.service");
let TrustModule = class TrustModule {
};
exports.TrustModule = TrustModule;
exports.TrustModule = TrustModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
                { name: booking_schema_1.Booking.name, schema: booking_schema_1.BookingSchema },
                { name: review_schema_1.Review.name, schema: review_schema_1.ReviewSchema },
            ]),
            notifications_module_1.NotificationsModule,
        ],
        controllers: [trust_controller_1.TrustController],
        providers: [trust_service_1.TrustService],
        exports: [trust_service_1.TrustService],
    })
], TrustModule);
//# sourceMappingURL=trust.module.js.map