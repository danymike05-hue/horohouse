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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AuthController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const auth_service_1 = require("./auth.service");
const auth_dto_1 = require("./dto/auth.dto");
const roles_guard_1 = require("./guards/roles.guard");
const jwt_auth_guard_1 = require("./guards/jwt.auth.guard");
const google_oauth_guard_1 = require("./guards/google-oauth.guard");
const onboarding_guard_1 = require("./guards/onboarding.guard");
const password_reset_dto_1 = require("./dto/password-reset.dto");
const google_onboarding_dto_1 = require("./dto/google-onboarding.dto");
let AuthController = AuthController_1 = class AuthController {
    authService;
    logger = new common_1.Logger(AuthController_1.name);
    constructor(authService) {
        this.authService = authService;
    }
    setAuthCookies(res, tokens) {
        const isProd = process.env.NODE_ENV === 'production';
        if (tokens.accessToken) {
            res.setCookie('access_token', tokens.accessToken, {
                httpOnly: true,
                secure: isProd,
                sameSite: 'lax',
                path: '/',
                maxAge: 7 * 24 * 60 * 60,
            });
        }
        if (tokens.refreshToken) {
            res.setCookie('refresh_token', tokens.refreshToken, {
                httpOnly: true,
                secure: isProd,
                sameSite: 'lax',
                path: '/',
                maxAge: 30 * 24 * 60 * 60,
            });
        }
    }
    clearAuthCookies(res) {
        res.clearCookie('access_token', { path: '/' });
        res.clearCookie('refresh_token', { path: '/' });
    }
    async sendPhoneCode(dto) {
        return this.authService.sendPhoneVerificationCode(dto);
    }
    async registerWithPhone(dto, req, res) {
        const tokens = await this.authService.registerWithPhone(dto, req);
        this.setAuthCookies(res, tokens);
        return tokens;
    }
    async registerWithEmail(dto, req, res) {
        const tokens = await this.authService.registerWithEmail(dto, req);
        this.setAuthCookies(res, tokens);
        return tokens;
    }
    async loginWithPhone(dto, req, res) {
        const tokens = await this.authService.loginWithPhone(dto, req);
        this.setAuthCookies(res, tokens);
        return tokens;
    }
    async loginWithEmail(dto, req, res) {
        const tokens = await this.authService.loginWithEmail(dto, req);
        this.setAuthCookies(res, tokens);
        return tokens;
    }
    async verifyPhone(dto) {
        return this.authService.verifyPhone(dto);
    }
    async refreshToken(body, req, res) {
        const token = body?.refreshToken || req.cookies?.refresh_token;
        if (!token) {
            throw new common_1.BadRequestException('Refresh token is required');
        }
        const tokens = await this.authService.refreshToken(token, req);
        this.setAuthCookies(res, tokens);
        return tokens;
    }
    async forgotPassword(dto) {
        return this.authService.requestPasswordReset(dto.email);
    }
    async validateResetToken(dto) {
        return this.authService.validateResetToken(dto.token);
    }
    async resetPassword(dto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }
    async checkEmail(dto) {
        return this.authService.checkEmail(dto.email);
    }
    async verifyEmail(dto) {
        return this.authService.verifyEmail(dto.token);
    }
    async googleLinkIntent(req) {
        const u = req.user;
        return this.authService.createGoogleLinkIntent(String(u.userId ?? u._id ?? u.sub));
    }
    async googleExchange(dto, req) {
        return this.authService.exchangeOAuthCode(dto.code, dto.codeVerifier, req);
    }
    async googleAuth() {
    }
    async googleAuthRedirect(req, res) {
        const googleUser = req.user;
        const state = String(req.query?.state ?? '');
        const target = this.authService.resolveOAuthRedirect(state);
        const withParams = (base, params) => `${base}${base.includes('?') ? '&' : '?'}${new URLSearchParams(params).toString()}`;
        if (target.kind === 'rejected') {
            const esc = (v) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
            res.status(400).type('text/html; charset=utf-8').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
                `<title>HoroHouse</title></head><body style="font-family:system-ui,sans-serif;padding:32px;max-width:520px;margin:auto;color:#222">` +
                `<h2>Sign-in could not be completed</h2><p>La connexion n'a pas pu aboutir.</p>` +
                `<p style="color:#6a6a6a">${esc(target.reason || '')}</p>` +
                `<p>Close this page and go back to the app. / Fermez cette page et revenez à l'application.</p></body></html>`);
            return res;
        }
        try {
            const dto = {
                googleId: googleUser.id,
                email: googleUser.email,
                name: googleUser.displayName,
                picture: googleUser.picture,
                emailVerified: googleUser.emailVerified,
            };
            if (target.kind === 'app' && target.linkToken) {
                try {
                    await this.authService.linkGoogle(target.linkToken, dto);
                    res.redirect(withParams(target.url, { linked: '1' }), 302);
                }
                catch (e) {
                    const inUse = e?.response?.code === 'GOOGLE_IN_USE';
                    this.logger.warn(`Google link failed: ${e?.message}`);
                    res.redirect(withParams(target.url, { error: inUse ? 'google_in_use' : 'link_failed' }), 302);
                }
                return res;
            }
            if (target.kind === 'app') {
                if (!target.challenge)
                    throw new common_1.BadRequestException('Missing sign-in challenge');
                const { user, isNewUser } = await this.authService.googleSignIn(dto);
                const code = await this.authService.issueOAuthCode(user, target.challenge, isNewUser);
                res.redirect(withParams(target.url, {
                    code,
                    ...(isNewUser ? { isNewUser: 'true' } : {}),
                    ...(user.onboardingStatus ? { onboardingStatus: user.onboardingStatus } : {}),
                }), 302);
                return res;
            }
            const authResult = await this.authService.googleAuth(dto, req);
            this.setAuthCookies(res, authResult);
            res.redirect(withParams(target.url, {
                token: authResult.accessToken,
                refresh: authResult.refreshToken,
                ...(authResult.isNewUser ? { isNewUser: 'true' } : {}),
                ...(authResult.onboardingStatus ? { onboardingStatus: authResult.onboardingStatus } : {}),
            }), 302);
            return res;
        }
        catch (error) {
            const msg = String(error?.message || error);
            this.logger.error(`Google callback failed: ${msg}`, error?.stack);
            const reason = msg.includes('deactivated') ? 'account_deactivated' : 'oauth_failed';
            const errorParams = { error: reason };
            if (process.env.NODE_ENV !== 'production')
                errorParams.detail = msg.slice(0, 200);
            const base = target.kind === 'app' && target.url
                ? target.url
                : `${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '')}/auth/login`;
            res.redirect(withParams(base, errorParams), 302);
            return res;
        }
    }
    async logout(req, res) {
        const u = req.user;
        const userId = u.userId || u._id?.toString() || u.sub;
        const sessionId = u.sessionId;
        if (sessionId)
            await this.authService.logout(userId, sessionId);
        this.clearAuthCookies(res);
    }
    async getProfile(req) {
        return {
            user: req.user,
        };
    }
    async verifyToken(req) {
        try {
            if (!req.user) {
                throw new Error('User not found in request');
            }
            let userId;
            if (req.user._id) {
                userId = req.user._id.toString();
            }
            else if (req.user.id) {
                userId = req.user.id;
            }
            else if (req.user.sub) {
                userId = req.user.sub;
            }
            else {
                throw new Error('User ID not found!');
            }
            return {
                valid: true,
                user: {
                    id: userId,
                    name: req.user.name || '',
                    email: req.user.email || '',
                    phoneNumber: req.user.phoneNumber || '',
                    role: req.user.role || 'guest',
                    profilePicture: req.user.profilePicture,
                    emailVerified: req.user.emailVerified || false,
                    phoneVerified: req.user.phoneVerified || false,
                    googleId: req.user.googleId,
                    hasPassword: !!req.user.hasPassword,
                    onboardingCompleted: req.user.onboardingCompleted ?? false,
                    onboardingStatus: req.user.onboardingStatus || 'completed',
                },
            };
        }
        catch (error) {
            throw new common_1.UnauthorizedException('Invalid token');
        }
    }
    async changePassword(body, req) {
        const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
        return this.authService.changePassword(userId, body.currentPassword, body.newPassword, req.user.sessionId);
    }
    async enable2FA(req) {
        return this.authService.enable2FA(req.user);
    }
    async disable2FA(req) {
        return this.authService.disable2FA(req.user);
    }
    async getSessions(req) {
        const sessions = await this.authService.getUserSessions(req.user);
        const currentSessionId = req.user.sessionId;
        const sessionsWithCurrent = sessions.map(session => ({
            ...session,
            current: session.id === currentSessionId
        }));
        return { sessions: sessionsWithCurrent };
    }
    async terminateAllSessions(req) {
        const currentSessionId = req.user.sessionId;
        if (!currentSessionId)
            throw new common_1.BadRequestException('Current session unknown');
        return this.authService.terminateAllSessions(req.user, currentSessionId);
    }
    async terminateSession(sessionId, req) {
        return this.authService.terminateSession(req.user, sessionId);
    }
    async resendEmailVerification(req) {
        return this.authService.resendEmailVerification(req.user);
    }
    async resendPhoneVerification(req) {
        return this.authService.resendPhoneVerification(req.user);
    }
    async deactivateAccount(req, res) {
        const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
        const result = await this.authService.deactivateAccount(userId);
        this.clearAuthCookies(res);
        return result;
    }
    async disconnectGoogle(req) {
        const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
        return this.authService.disconnectGoogle(userId);
    }
    async getOnboardingStatus(req) {
        const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
        return this.authService.getGoogleOnboardingStatus(userId);
    }
    async selectOnboardingRole(dto, req) {
        const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
        return this.authService.selectOnboardingRole(userId, dto.role);
    }
    async setOnboardingPhone(dto, req) {
        const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
        return this.authService.setOnboardingPhone(userId, dto.phoneNumber);
    }
    async completeOnboarding(req, res) {
        const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
        const result = await this.authService.completeGoogleOnboarding(userId, req, req.user.sessionId);
        this.setAuthCookies(res, result);
        return result;
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, common_1.Post)('send-phone-code'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Send phone verification code' }),
    (0, swagger_1.ApiBody)({ type: auth_dto_1.SendPhoneCodeRequestDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Verification code sent successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid phone number' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.SendPhoneCodeRequestDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "sendPhoneCode", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('register/phone'),
    (0, swagger_1.ApiOperation)({ summary: 'Register with phone number' }),
    (0, swagger_1.ApiBody)({ type: auth_dto_1.RegisterPhoneDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'User registered successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'User already exists' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RegisterPhoneDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "registerWithPhone", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('register/email'),
    (0, swagger_1.ApiOperation)({ summary: 'Register with email and password' }),
    (0, swagger_1.ApiBody)({ type: auth_dto_1.RegisterEmailDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'User registered successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'User already exists' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RegisterEmailDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "registerWithEmail", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('login/phone'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Login with phone verification code' }),
    (0, swagger_1.ApiBody)({ type: auth_dto_1.LoginPhoneDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Login successful' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid credentials' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginPhoneDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "loginWithPhone", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('login/email'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Login with email and password' }),
    (0, swagger_1.ApiBody)({ type: auth_dto_1.LoginEmailDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Login successful' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid credentials' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.LoginEmailDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "loginWithEmail", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('verify-phone'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Verify phone number' }),
    (0, swagger_1.ApiBody)({ type: auth_dto_1.VerifyPhoneRequestDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Phone verified successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid verification code' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.VerifyPhoneRequestDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyPhone", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 30, ttl: 60000 } }),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh access token' }),
    (0, swagger_1.ApiBody)({ type: auth_dto_1.RefreshTokenDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Token refreshed successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid refresh token' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.RefreshTokenDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refreshToken", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, common_1.Post)('forgot-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Request password reset' }),
    (0, swagger_1.ApiBody)({ type: password_reset_dto_1.ForgotPasswordDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Password reset email sent if account exists' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_reset_dto_1.ForgotPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('validate-reset-token'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Validate password reset token' }),
    (0, swagger_1.ApiBody)({ type: password_reset_dto_1.ValidateResetTokenDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Token validation result' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_reset_dto_1.ValidateResetTokenDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "validateResetToken", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60000 } }),
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Reset password with token' }),
    (0, swagger_1.ApiBody)({ type: password_reset_dto_1.ResetPasswordDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Password reset successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid or expired token' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_reset_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('check-email'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Does an account exist for this email? (sign-up asks before the last step)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.CheckEmailDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "checkEmail", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('verify-email'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Confirm an email address with the token from the verification email' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.VerifyEmailDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyEmail", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, onboarding_guard_1.AllowIncompleteOnboarding)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('google/link-intent'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Start "Connect Google" for the signed-in account (one-time token, 10 min)' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleLinkIntent", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('google/exchange'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'App: swap the one-time Google sign-in code (+ PKCE verifier) for tokens' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.OAuthExchangeDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleExchange", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Get)('google'),
    (0, common_1.UseGuards)(google_oauth_guard_1.GoogleOAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Initiate Google OAuth login' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuth", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Get)('google/callback'),
    (0, common_1.UseGuards)(google_oauth_guard_1.GoogleOAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Google OAuth callback' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuthRedirect", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('logout'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Logout user' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Logout successful' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('profile'),
    (0, onboarding_guard_1.AllowIncompleteOnboarding)(),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User profile retrieved' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getProfile", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, onboarding_guard_1.AllowIncompleteOnboarding)(),
    (0, common_1.Get)('verify-token'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Verify if current token is valid' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyToken", null);
__decorate([
    (0, common_1.Post)('change-password'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Change user password' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Password changed successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid current password' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.ChangePasswordDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Post)('enable-2fa'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Enable two-factor authentication' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '2FA enabled successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "enable2FA", null);
__decorate([
    (0, common_1.Post)('disable-2fa'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Disable two-factor authentication' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '2FA disabled successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "disable2FA", null);
__decorate([
    (0, common_1.Get)('sessions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get user active sessions' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Sessions retrieved successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getSessions", null);
__decorate([
    (0, common_1.Delete)('sessions/all'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Terminate all other sessions' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'All other sessions terminated successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "terminateAllSessions", null);
__decorate([
    (0, common_1.Delete)('sessions/:sessionId'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Terminate a specific session' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Session terminated successfully' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "terminateSession", null);
__decorate([
    (0, common_1.Post)('resend-email-verification'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Resend email verification' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Verification email sent' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resendEmailVerification", null);
__decorate([
    (0, common_1.Post)('resend-phone-verification'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Resend phone verification' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Verification SMS sent' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resendPhoneVerification", null);
__decorate([
    (0, common_1.Post)('deactivate-account'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Self-service account deactivation — sets isActive=false and invalidates all sessions' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Account deactivated successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'User not found' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "deactivateAccount", null);
__decorate([
    (0, common_1.Post)('disconnect/google'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Disconnect Google social login from the account (requires password to be set)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Google account disconnected successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Cannot disconnect — user has no password set' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "disconnectGoogle", null);
__decorate([
    (0, common_1.Get)('onboarding/status'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, onboarding_guard_1.AllowIncompleteOnboarding)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get Google onboarding status for the current user' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Onboarding status retrieved successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getOnboardingStatus", null);
__decorate([
    (0, common_1.Post)('onboarding/select-role'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, onboarding_guard_1.AllowIncompleteOnboarding)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Step 1: Select role during Google onboarding' }),
    (0, swagger_1.ApiBody)({ type: google_onboarding_dto_1.SelectRoleDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Role selected successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid role or onboarding already completed' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [google_onboarding_dto_1.SelectRoleDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "selectOnboardingRole", null);
__decorate([
    (0, common_1.Post)('onboarding/set-phone'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, onboarding_guard_1.AllowIncompleteOnboarding)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Step 2: Set phone number during Google onboarding' }),
    (0, swagger_1.ApiBody)({ type: google_onboarding_dto_1.SetPhoneDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Phone number set successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid phone number or wrong onboarding step' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Phone number already registered' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [google_onboarding_dto_1.SetPhoneDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "setOnboardingPhone", null);
__decorate([
    (0, common_1.Post)('onboarding/complete'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, onboarding_guard_1.AllowIncompleteOnboarding)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Step 3: Complete Google onboarding' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Onboarding completed successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Missing required fields or already completed' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "completeOnboarding", null);
exports.AuthController = AuthController = AuthController_1 = __decorate([
    (0, swagger_1.ApiTags)('Authentication'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map