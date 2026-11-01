"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const notifications_controller_1 = require("./notifications.controller");
const notifications_service_1 = require("./notifications.service");
const notifications_gateway_1 = require("./notifications.gateway");
const push_notifications_service_1 = require("./push-notifications.service");
const notification_schema_1 = require("./schemas/notification.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const devices_module_1 = require("../devices/devices.module");
const email_module_1 = require("../email/email.module");
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: notification_schema_1.Notification.name, schema: notification_schema_1.NotificationSchema },
                { name: user_schema_1.User.name, schema: user_schema_1.UserSchema },
            ]),
            devices_module_1.DevicesModule,
            email_module_1.EmailModule,
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => {
                    const expiresIn = configService.get('JWT_EXPIRES_IN', '15m');
                    let expiresInSeconds;
                    if (expiresIn.endsWith('d')) {
                        expiresInSeconds = parseInt(expiresIn) * 24 * 60 * 60;
                    }
                    else if (expiresIn.endsWith('h')) {
                        expiresInSeconds = parseInt(expiresIn) * 60 * 60;
                    }
                    else if (expiresIn.endsWith('m')) {
                        expiresInSeconds = parseInt(expiresIn) * 60;
                    }
                    else if (expiresIn.endsWith('s')) {
                        expiresInSeconds = parseInt(expiresIn);
                    }
                    else {
                        expiresInSeconds = parseInt(expiresIn) || 900;
                    }
                    return {
                        secret: configService.get('JWT_SECRET'),
                        signOptions: { expiresIn: expiresInSeconds },
                    };
                },
                inject: [config_1.ConfigService],
            }),
        ],
        controllers: [notifications_controller_1.NotificationsController],
        providers: [
            notifications_service_1.NotificationsService,
            notifications_gateway_1.NotificationsGateway,
            push_notifications_service_1.PushNotificationsService,
        ],
        exports: [
            notifications_service_1.NotificationsService,
            notifications_gateway_1.NotificationsGateway,
        ],
    })
], NotificationsModule);
//# sourceMappingURL=notifications.module.js.map