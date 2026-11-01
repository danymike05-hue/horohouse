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
var GoogleStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleStrategy = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const config_1 = require("@nestjs/config");
const passport_google_oauth20_1 = require("passport-google-oauth20");
const auth_service_1 = require("../auth.service");
let GoogleStrategy = GoogleStrategy_1 = class GoogleStrategy extends (0, passport_1.PassportStrategy)(passport_google_oauth20_1.Strategy, 'google') {
    authService;
    configService;
    constructor(authService, configService) {
        const clientID = configService.get('GOOGLE_CLIENT_ID') || 'DISABLED_GOOGLE_OAUTH';
        const clientSecret = configService.get('GOOGLE_CLIENT_SECRET') || 'DISABLED_GOOGLE_OAUTH';
        const callbackURL = configService.get('GOOGLE_CALLBACK_URL') || 'http://localhost/disabled-google-callback';
        super({
            clientID,
            clientSecret,
            callbackURL,
            scope: ['email', 'profile'],
        });
        this.authService = authService;
        this.configService = configService;
        if (clientID === 'DISABLED_GOOGLE_OAUTH' ||
            clientSecret === 'DISABLED_GOOGLE_OAUTH' ||
            callbackURL === 'http://localhost/disabled-google-callback') {
            common_1.Logger.warn('Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL to enable it.', GoogleStrategy_1.name);
        }
    }
    async validate(accessToken, refreshToken, profile, done) {
        try {
            const isDisabled = !this.configService.get('GOOGLE_CLIENT_ID') ||
                !this.configService.get('GOOGLE_CLIENT_SECRET') ||
                !this.configService.get('GOOGLE_CALLBACK_URL');
            if (isDisabled) {
                return done(new common_1.ServiceUnavailableException('Google OAuth is not configured on this server.'));
            }
            const googleUser = {
                id: profile.id,
                email: profile.emails[0].value,
                displayName: profile.displayName,
                firstName: profile.name.givenName,
                lastName: profile.name.familyName,
                picture: profile.photos[0].value,
                accessToken,
                refreshToken,
            };
            done(null, googleUser);
        }
        catch (error) {
            done(error, false);
        }
    }
};
exports.GoogleStrategy = GoogleStrategy;
exports.GoogleStrategy = GoogleStrategy = GoogleStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], GoogleStrategy);
//# sourceMappingURL=google.strategy.js.map