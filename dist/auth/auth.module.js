"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const auth_service_1 = require("./auth.service");
const auth_controller_1 = require("./auth.controller");
const sms_service_1 = require("./sms.service");
const jwt_strategy_1 = require("./strategies/jwt.strategy");
const google_strategy_1 = require("./strategies/google.strategy");
const roles_guard_1 = require("./guards/roles.guard");
const jwt_auth_guard_1 = require("./guards/jwt.auth.guard");
const onboarding_guard_1 = require("./guards/onboarding.guard");
const user_schema_1 = require("../users/schemas/user.schema");
const email_module_1 = require("../email/email.module");
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [
            passport_1.PassportModule.register({ defaultStrategy: 'jwt' }),
            jwt_1.JwtModule.registerAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => {
                    const expiresIn = configService.get('JWT_EXPIRATION', '15m');
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
                        signOptions: {
                            expiresIn: expiresInSeconds,
                        },
                    };
                },
                inject: [config_1.ConfigService],
            }),
            mongoose_1.MongooseModule.forFeature([{ name: user_schema_1.User.name, schema: user_schema_1.UserSchema }]),
            email_module_1.EmailModule,
        ],
        controllers: [auth_controller_1.AuthController],
        providers: [
            auth_service_1.AuthService,
            sms_service_1.SmsService,
            jwt_strategy_1.JwtStrategy,
            google_strategy_1.GoogleStrategy,
            roles_guard_1.RolesGuard,
            jwt_auth_guard_1.JwtAuthGuard,
            onboarding_guard_1.OnboardingGuard,
        ],
        exports: [auth_service_1.AuthService, sms_service_1.SmsService, jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard, onboarding_guard_1.OnboardingGuard],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map