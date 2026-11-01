"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const throttler_1 = require("@nestjs/throttler");
const schedule_1 = require("@nestjs/schedule");
const core_1 = require("@nestjs/core");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const auth_module_1 = require("./auth/auth.module");
const users_module_1 = require("./users/users.module");
const properties_module_1 = require("./properties/properties.module");
const history_module_1 = require("./history/history.module");
const analytics_module_1 = require("./analytics/analytics.module");
const cloudinary_module_1 = require("./cloudinary/cloudinary.module");
const email_module_1 = require("./email/email.module");
const onboarding_module_1 = require("./onboarding/onboarding.module");
const notifications_module_1 = require("./notifications/notifications.module");
const saved_searches_module_1 = require("./saved-searches/saved-searches.module");
const reviews_module_1 = require("./reviews/reviews.module");
const user_interactions_module_1 = require("./user-interactions/user-interactions.module");
const recommendation_module_1 = require("./recommendations/recommendation.module");
const payments_module_1 = require("./payments/payments.module");
const ai_chat_module_1 = require("./ai-chat/ai-chat.module");
const chat_module_1 = require("./chat/chat.module");
const leads_module_1 = require("./leads/leads.module");
const appointments_module_1 = require("./appointments/appointments.module");
const system_settings_module_1 = require("./system-settings/system-settings.module");
const bookings_module_1 = require("./bookings/bookings.module");
const reports_module_1 = require("./reports/reports.module");
const rooms_module_1 = require("./rooms/rooms.module");
const student_profiles_module_1 = require("./student-profiles/student-profiles.module");
const student_properties_module_1 = require("./student-properties/student-properties.module");
const split_payments_module_1 = require("./split-payments/split-payments.module");
const digital_lease_module_1 = require("./digital-lease/digital-lease.module");
const roommate_module_1 = require("./roommate/roommate.module");
const newsletter_module_1 = require("./newsletter/newsletter.module");
const insights_module_1 = require("./insights/insights.module");
const community_module_1 = require("./community/community.module");
const devices_module_1 = require("./devices/devices.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
            mongoose_1.MongooseModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: async (configService) => ({
                    uri: configService.get('MONGODB_URI'),
                    maxPoolSize: 50,
                    minPoolSize: 5,
                    serverSelectionTimeoutMS: 5000,
                    socketTimeoutMS: 45000,
                    connectTimeoutMS: 10000,
                    compressors: ['zlib'],
                }),
                inject: [config_1.ConfigService],
            }),
            schedule_1.ScheduleModule.forRoot(),
            throttler_1.ThrottlerModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => [
                    {
                        name: 'default',
                        ttl: 60 * 1000,
                        limit: 100,
                    },
                    {
                        name: 'notifications',
                        ttl: 60 * 1000,
                        limit: 200,
                    },
                ],
                inject: [config_1.ConfigService],
            }),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            properties_module_1.PropertiesModule,
            history_module_1.HistoryModule,
            analytics_module_1.AnalyticsModule,
            cloudinary_module_1.CloudinaryModule,
            email_module_1.EmailModule,
            onboarding_module_1.OnboardingModule,
            notifications_module_1.NotificationsModule,
            saved_searches_module_1.SavedSearchesModule,
            reviews_module_1.ReviewsModule,
            user_interactions_module_1.UserInteractionsModule,
            recommendation_module_1.RecommendationModule,
            payments_module_1.PaymentsModule,
            ai_chat_module_1.AiChatModule,
            chat_module_1.ChatModule,
            leads_module_1.LeadsModule,
            appointments_module_1.AppointmentsModule,
            system_settings_module_1.SystemSettingsModule,
            bookings_module_1.BookingsModule,
            reports_module_1.ReportsModule,
            rooms_module_1.RoomsModule,
            student_profiles_module_1.StudentProfilesModule,
            student_properties_module_1.StudentPropertiesModule,
            split_payments_module_1.SplitPaymentsModule,
            digital_lease_module_1.DigitalLeaseModule,
            roommate_module_1.RoommateMatchingModule,
            newsletter_module_1.NewsletterModule,
            insights_module_1.InsightsModule,
            community_module_1.CommunityModule,
            devices_module_1.DevicesModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [
            app_service_1.AppService,
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map