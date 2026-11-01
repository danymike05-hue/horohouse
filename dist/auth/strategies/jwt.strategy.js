"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const passport_jwt_1 = require("passport-jwt");
const auth_service_1 = require("../auth.service");
let JwtStrategy = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    authService;
    configService;
    constructor(authService, configService) {
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromExtractors([
                (req) => {
                    if (req && req.cookies && req.cookies.access_token) {
                        return req.cookies.access_token;
                    }
                    return null;
                },
                passport_jwt_1.ExtractJwt.fromAuthHeaderAsBearerToken(),
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.get('JWT_SECRET'),
        });
        this.authService = authService;
        this.configService = configService;
    }
    async validate(payload) {
        try {
            console.log('[JwtStrategy] Validating JWT payload:', {
                sub: payload.sub,
                sessionId: payload.sessionId,
                role: payload.role,
            });
            const user = await this.authService.validateUser(payload);
            console.log('[JwtStrategy] User validated:', {
                userId: user._id.toString(),
                role: user.role,
                email: user.email,
            });
            const normalizedUser = {
                userId: user._id.toString(),
                _id: user._id,
                id: user._id.toString(),
                sub: payload.sub,
                sessionId: payload.sessionId,
                email: user.email,
                phoneNumber: user.phoneNumber,
                name: user.name,
                role: user.role,
                emailVerified: user.emailVerified,
                phoneVerified: user.phoneVerified,
                profilePicture: user.profilePicture,
                isActive: user.isActive,
                preferences: user.preferences,
                agentPreferences: user.agentPreferences,
                onboardingCompleted: user.onboardingCompleted,
                onboardingStatus: user.onboardingStatus,
                licenseNumber: user.licenseNumber,
                agency: user.agency,
                googleId: user.googleId,
                hasPassword: !!user.password,
            };
            console.log('[JwtStrategy] Returning normalized user with userId:', normalizedUser.userId);
            return normalizedUser;
        }
        catch (error) {
            console.error('[JwtStrategy] Validation error:', error);
            throw new common_1.UnauthorizedException('Invalid token');
        }
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map