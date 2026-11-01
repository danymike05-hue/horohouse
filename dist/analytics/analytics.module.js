"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const analytics_controller_1 = require("./analytics.controller");
const analytics_service_1 = require("./analytics.service");
const user_schema_1 = require("../users/schemas/user.schema");
const property_schema_1 = require("../properties/schemas/property.schema");
const inquiry_schema_1 = require("../properties/schemas/inquiry.schema");
const history_schema_1 = require("../history/schemas/history.schema");
const admin_analytics_controller_1 = require("./admin-analytics.controller");
const admin_analytics_service_1 = require("./admin-analytics.service");
const booking_schema_1 = require("../bookings/schema/booking.schema");
const review_schema_1 = require("../reviews/schemas/review.schema");
let AnalyticsModule = class AnalyticsModule {
};
exports.AnalyticsModule = AnalyticsModule;
exports.AnalyticsModule = AnalyticsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
                { name: property_schema_1.Property.name, schema: property_schema_1.PropertySchema },
                { name: inquiry_schema_1.Inquiry.name, schema: inquiry_schema_1.InquirySchema },
                { name: history_schema_1.History.name, schema: history_schema_1.HistorySchema },
                { name: booking_schema_1.Booking.name, schema: booking_schema_1.BookingSchema },
                { name: review_schema_1.Review.name, schema: review_schema_1.ReviewSchema },
            ]),
        ],
        controllers: [
            analytics_controller_1.AnalyticsController,
            admin_analytics_controller_1.AdminAnalyticsController,
        ],
        providers: [
            analytics_service_1.AnalyticsService,
            admin_analytics_service_1.AdminAnalyticsService,
        ],
        exports: [
            analytics_service_1.AnalyticsService,
            admin_analytics_service_1.AdminAnalyticsService,
        ],
    })
], AnalyticsModule);
//# sourceMappingURL=analytics.module.js.map