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
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const sms_service_1 = require("./sms.service");
const email_service_1 = require("../email/email.service");
const user_schema_1 = require("../users/schemas/user.schema");
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const sha256b64url = (v) => crypto.createHash('sha256').update(v).digest('base64url');
const escapeRegex = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const emailQuery = (email) => ({ $regex: `^${escapeRegex(email.trim().toLowerCase())}$`, $options: 'i' });
const safeEqual = (a, b) => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const isPlaceholderPhone = (p) => !p || p.startsWith('google_') || p.startsWith('temp_');
const onboardingDone = (u) => u.onboardingStatus === user_schema_1.OnboardingStatus.COMPLETED && !(u.phoneNumber || '').startsWith('google_');
const MAX_CODE_ATTEMPTS = 5;
const OAUTH_CODE_TTL_MS = 2 * 60 * 1000;
const ROTATION_GRACE_MS = 30 * 1000;
let AuthService = class AuthService {
    static { AuthService_1 = this; }
    userModel;
    smsService;
    emailService;
    jwtService;
    configService;
    logger = new common_1.Logger(AuthService_1.name);
    static DUMMY_HASH = bcrypt.hashSync('horohouse-timing-placeholder', 12);
    static SELF_ASSIGNABLE_ROLES = [
        user_schema_1.UserRole.REGISTERED_USER,
        user_schema_1.UserRole.AGENT,
        user_schema_1.UserRole.LANDLORD,
        user_schema_1.UserRole.HOST,
        user_schema_1.UserRole.STUDENT,
    ];
    resolveSelfAssignableRole(requested) {
        if (requested && AuthService_1.SELF_ASSIGNABLE_ROLES.includes(requested)) {
            return requested;
        }
        return user_schema_1.UserRole.REGISTERED_USER;
    }
    constructor(userModel, smsService, emailService, jwtService, configService) {
        this.userModel = userModel;
        this.smsService = smsService;
        this.emailService = emailService;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async sendPhoneVerificationCode(dto) {
        try {
            const { phoneNumber } = dto;
            if (!this.smsService.isValidPhoneNumber(phoneNumber)) {
                throw new common_1.BadRequestException('Invalid phone number format');
            }
            const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);
            const existing = await this.userModel
                .findOne({ phoneNumber: formattedPhone })
                .select('phoneVerificationSentAt')
                .lean();
            const COOLDOWN_MS = 60 * 1000;
            if (existing &&
                existing.phoneVerificationSentAt &&
                Date.now() - new Date(existing.phoneVerificationSentAt).getTime() < COOLDOWN_MS) {
                throw new common_1.BadRequestException('A verification code was already sent recently. Please wait before requesting another.');
            }
            if (!existing) {
                this.logger.log(`Phone code requested for unknown number ${formattedPhone.slice(0, 5)}…`);
                return { message: 'Verification code sent successfully' };
            }
            const verificationCode = this.smsService.generateVerificationCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            await this.userModel.updateOne({ _id: existing._id }, {
                phoneVerificationCode: sha256(String(verificationCode)),
                phoneVerificationExpires: expiresAt,
                phoneVerificationSentAt: new Date(),
                phoneVerificationAttempts: 0,
            });
            const smsSent = await this.smsService.sendVerificationCode(formattedPhone, verificationCode);
            if (!smsSent) {
                throw new common_1.BadRequestException('Failed to send verification code');
            }
            this.logger.log(`Verification code sent to ${formattedPhone.slice(0, 5)}…`);
            return { message: 'Verification code sent successfully' };
        }
        catch (error) {
            this.logger.error('Failed to send phone verification code:', error);
            throw error;
        }
    }
    async registerWithPhone(dto, req) {
        try {
            const { name, phoneNumber, role } = dto;
            const email = dto.email ? dto.email.trim().toLowerCase() : undefined;
            const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);
            const existingUser = await this.userModel.findOne({
                $or: [
                    { phoneNumber: formattedPhone },
                    ...(email ? [{ email: emailQuery(email) }] : [])
                ]
            });
            if (existingUser) {
                throw new common_1.ConflictException('User already exists with this phone number or email');
            }
            const user = await this.userModel.create({
                name,
                phoneNumber: formattedPhone,
                email,
                role: this.resolveSelfAssignableRole(role),
                phoneVerified: false,
                emailVerified: false,
                onboardingCompleted: true,
                onboardingStatus: user_schema_1.OnboardingStatus.COMPLETED,
            });
            this.logger.log(`New user registered with phone: ${formattedPhone.slice(0, 5)}…`);
            if (user.email) {
                const verificationToken = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                await this.userModel.findByIdAndUpdate(user._id, {
                    emailVerificationToken: verificationToken,
                    emailVerificationExpires: expiresAt
                });
                void this.emailService.sendWelcomeEmail(user.email, user.name).catch(() => undefined);
                void this.emailService.sendEmailVerification(user.email, user.name, verificationToken).catch(() => undefined);
            }
            const tokens = await this.generateTokens(user, req);
            return {
                ...tokens,
                user: user.toJSON(),
            };
        }
        catch (error) {
            this.logger.error('Phone registration failed:', error);
            throw error;
        }
    }
    async registerWithEmail(dto, req) {
        try {
            const { name, email, password, phoneNumber, role } = dto;
            const normalizedEmail = email.trim().toLowerCase();
            const formattedPhone = phoneNumber ? this.smsService.formatPhoneNumber(phoneNumber) : undefined;
            const [emailTaken, phoneTaken] = await Promise.all([
                this.userModel.exists({ email: emailQuery(normalizedEmail) }),
                formattedPhone ? this.userModel.exists({ phoneNumber: formattedPhone }) : Promise.resolve(null),
            ]);
            if (emailTaken) {
                throw new common_1.ConflictException({ message: 'An account already exists with this email', field: 'email', code: 'EMAIL_TAKEN' });
            }
            if (phoneTaken) {
                throw new common_1.ConflictException({ message: 'This phone number is already used by another account', field: 'phone', code: 'PHONE_TAKEN' });
            }
            const hashedPassword = await bcrypt.hash(password, 12);
            const user = await this.userModel.create({
                name,
                email: normalizedEmail,
                password: hashedPassword,
                phoneNumber: formattedPhone || `temp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
                role: this.resolveSelfAssignableRole(role),
                phoneVerified: false,
                emailVerified: false,
                onboardingCompleted: true,
                onboardingStatus: user_schema_1.OnboardingStatus.COMPLETED,
            });
            this.logger.log(`New user registered with email: ${normalizedEmail}`);
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await this.userModel.findByIdAndUpdate(user._id, {
                emailVerificationToken: verificationToken,
                emailVerificationExpires: expiresAt
            });
            void this.emailService.sendWelcomeEmail(user.email, user.name).catch(() => undefined);
            void this.emailService.sendEmailVerification(user.email, user.name, verificationToken).catch(() => undefined);
            const tokens = await this.generateTokens(user, req);
            return {
                ...tokens,
                user: user.toJSON(),
            };
        }
        catch (error) {
            this.logger.error('Email registration failed:', error);
            throw error;
        }
    }
    async loginWithPhone(dto, req) {
        try {
            const { phoneNumber, verificationCode } = dto;
            const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);
            const user = await this.userModel
                .findOne({ phoneNumber: formattedPhone })
                .select('+phoneVerificationCode +phoneVerificationAttempts');
            if (!user) {
                throw new common_1.UnauthorizedException('Invalid verification code');
            }
            if (!user.isActive) {
                throw new common_1.UnauthorizedException('This account is deactivated');
            }
            await this.checkPhoneCode(user, verificationCode);
            this.logger.log(`User logged in with phone: ${formattedPhone.slice(0, 5)}…`);
            const tokens = await this.generateTokens(user, req);
            return {
                ...tokens,
                user: user.toJSON(),
            };
        }
        catch (error) {
            this.logger.error('Phone login failed:', error);
            throw error;
        }
    }
    async loginWithEmail(dto, req) {
        try {
            const { email, password } = dto;
            const normalizedEmail = email.trim().toLowerCase();
            const user = await this.userModel
                .findOne({ email: emailQuery(normalizedEmail) })
                .select('+password');
            if (!user || !user.password) {
                await bcrypt.compare(password, AuthService_1.DUMMY_HASH);
                throw new common_1.UnauthorizedException({
                    message: 'Incorrect email or password',
                    ...(user && !user.password && user.googleId ? { code: 'USE_GOOGLE' } : {}),
                });
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                throw new common_1.UnauthorizedException('Incorrect email or password');
            }
            if (!user.isActive) {
                throw new common_1.UnauthorizedException({ message: 'This account is deactivated', code: 'ACCOUNT_DEACTIVATED' });
            }
            this.logger.log(`User logged in with email: ${normalizedEmail}`);
            const tokens = await this.generateTokens(user, req);
            return {
                ...tokens,
                user: user.toJSON(),
            };
        }
        catch (error) {
            this.logger.error('Email login failed:', error);
            throw error;
        }
    }
    async googleSignIn(dto) {
        const { googleId, name, picture } = dto;
        const email = (dto.email || '').trim().toLowerCase();
        if (!googleId || !email) {
            throw new common_1.UnauthorizedException('Google did not return an email address');
        }
        if (dto.emailVerified === false) {
            throw new common_1.UnauthorizedException('Your Google email address is not verified');
        }
        let user = (await this.userModel.findOne({ googleId }).select('+password').exec());
        if (!user)
            user = (await this.userModel.findOne({ email: emailQuery(email) }).select('+password').exec());
        let isNewUser = false;
        if (!user) {
            isNewUser = true;
            user = await this.userModel.create({
                googleId,
                name,
                email,
                profilePicture: picture,
                phoneNumber: `google_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
                role: user_schema_1.UserRole.REGISTERED_USER,
                emailVerified: true,
                phoneVerified: false,
                onboardingCompleted: false,
                onboardingStatus: user_schema_1.OnboardingStatus.NOT_STARTED,
            });
            this.logger.log(`New user created via Google OAuth: ${user._id}`);
            if (user.email) {
                void this.emailService.sendWelcomeEmail(user.email, user.name).catch(() => undefined);
            }
            return { user, isNewUser };
        }
        if (!user.isActive) {
            throw new common_1.UnauthorizedException('This account is deactivated');
        }
        if (!user.googleId && !user.emailVerified && user.password) {
            this.logger.warn(`Google sign-in for unverified email account ${user._id}: removing unverified password and sessions`);
            user.password = undefined;
            user.sessions = [];
        }
        if (!user.googleId)
            user.googleId = googleId;
        if (!user.profilePicture && picture)
            user.profilePicture = picture;
        user.emailVerified = true;
        const explicitlyCompleted = (user.onboardingStatus === user_schema_1.OnboardingStatus.COMPLETED || user.onboardingCompleted === true) &&
            !(user.phoneNumber || '').startsWith('google_');
        const implicitlyCompleted = !isPlaceholderPhone(user.phoneNumber) &&
            user.role !== user_schema_1.UserRole.REGISTERED_USER &&
            AuthService_1.ONBOARDING_SELF_ASSIGNABLE_ROLES.includes(user.role);
        if (explicitlyCompleted || implicitlyCompleted) {
            if (user.onboardingStatus !== user_schema_1.OnboardingStatus.COMPLETED) {
                user.onboardingStatus = user_schema_1.OnboardingStatus.COMPLETED;
                user.onboardingCompleted = true;
            }
        }
        else {
            if (!user.onboardingStatus) {
                user.onboardingStatus = user_schema_1.OnboardingStatus.NOT_STARTED;
            }
            user.onboardingCompleted = false;
            isNewUser = true;
        }
        await user.save();
        this.logger.log(`Existing user signed in via Google: ${user._id}, onboardingStatus: ${user.onboardingStatus}`);
        return { user, isNewUser };
    }
    async googleAuth(dto, req) {
        const { user, isNewUser } = await this.googleSignIn(dto);
        const tokens = await this.generateTokens(user, req);
        return {
            ...tokens,
            user: user.toJSON(),
            isNewUser,
            onboardingStatus: user.onboardingStatus,
        };
    }
    resolveOAuthRedirect(state) {
        const webBase = (this.configService.get('FRONTEND_URL') || 'http://localhost:3000').replace(/\/+$/, '');
        const fallback = { kind: 'web', url: `${webBase}/auth/callback` };
        if (!state)
            return fallback;
        let parsed;
        try {
            parsed = new URL(state);
        }
        catch {
            return { kind: 'rejected', url: '', reason: 'The return link is not a valid URL.' };
        }
        const allowExpoGo = this.configService.get('OAUTH_ALLOW_EXPO_GO') === 'true' ||
            this.configService.get('NODE_ENV') !== 'production';
        const configured = (this.configService.get('OAUTH_APP_SCHEMES') || 'horohouse')
            .split(',').map((x) => x.trim().toLowerCase().replace(/:\/*$/, '')).filter(Boolean);
        const appSchemes = [
            ...configured.flatMap((x) => [`${x}:`, `exp+${x}:`]),
            ...(allowExpoGo ? ['exp:', 'exps:'] : []),
        ];
        if (appSchemes.includes(parsed.protocol)) {
            const challenge = parsed.searchParams.get('cc') || undefined;
            const linkToken = parsed.searchParams.get('lt') || undefined;
            for (const k of ['code', 'token', 'refresh', 'error', 'isNewUser', 'onboardingStatus', 'lt', 'linked'])
                parsed.searchParams.delete(k);
            return { kind: 'app', url: parsed.toString(), challenge, linkToken };
        }
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            const allowed = [webBase, ...(this.configService.get('OAUTH_WEB_REDIRECTS') || '').split(',')]
                .map((o) => o.trim())
                .filter(Boolean)
                .map((o) => {
                try {
                    return new URL(o).origin;
                }
                catch {
                    return null;
                }
            })
                .filter(Boolean);
            if (allowed.includes(parsed.origin))
                return { kind: 'web', url: parsed.toString() };
        }
        this.logger.warn(`Rejected OAuth redirect target: ${parsed.protocol}//${parsed.host}`);
        const reason = parsed.protocol === 'exp:' || parsed.protocol === 'exps:'
            ? 'Expo Go links are turned off on this server. Set OAUTH_ALLOW_EXPO_GO=true in the backend .env (or use a development build).'
            : `The return link scheme "${parsed.protocol}" is not allowed. Add it to OAUTH_APP_SCHEMES (app) or OAUTH_WEB_REDIRECTS (web) in the backend .env.`;
        return { kind: 'rejected', url: '', reason };
    }
    async issueOAuthCode(user, challenge, isNewUser) {
        if (!/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) {
            throw new common_1.BadRequestException('Missing or invalid sign-in challenge');
        }
        const code = crypto.randomBytes(32).toString('base64url');
        await this.userModel.updateOne({ _id: user._id }, {
            oauthCodeHash: sha256(code),
            oauthCodeChallenge: challenge,
            oauthCodeExpires: new Date(Date.now() + OAUTH_CODE_TTL_MS),
            oauthCodeNewUser: isNewUser,
        });
        return code;
    }
    async exchangeOAuthCode(code, codeVerifier, req) {
        const consumed = await this.userModel
            .findOneAndUpdate({ oauthCodeHash: sha256(code), oauthCodeExpires: { $gt: new Date() } }, { $unset: { oauthCodeHash: 1, oauthCodeChallenge: 1, oauthCodeExpires: 1, oauthCodeNewUser: 1 } })
            .select('+oauthCodeChallenge +oauthCodeNewUser');
        if (!consumed || !consumed.oauthCodeChallenge) {
            throw new common_1.UnauthorizedException('This sign-in link has expired. Please try again.');
        }
        if (!safeEqual(sha256b64url(codeVerifier), consumed.oauthCodeChallenge)) {
            this.logger.warn(`OAuth code for ${consumed._id} used with a wrong verifier`);
            throw new common_1.UnauthorizedException('This sign-in link was not started on this device.');
        }
        const user = await this.userModel.findById(consumed._id);
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('User not found or inactive');
        }
        const tokens = await this.generateTokens(user, req);
        return {
            ...tokens,
            user: user.toJSON(),
            isNewUser: !!consumed.oauthCodeNewUser,
            onboardingStatus: user.onboardingStatus,
        };
    }
    async createGoogleLinkIntent(userId) {
        const linkToken = crypto.randomBytes(24).toString('base64url');
        await this.userModel.updateOne({ _id: userId }, { oauthLinkHash: sha256(linkToken), oauthLinkExpires: new Date(Date.now() + 10 * 60 * 1000) });
        return { linkToken };
    }
    async linkGoogle(linkToken, google) {
        if (!google.googleId)
            throw new common_1.UnauthorizedException('Google did not return an account id');
        if (google.emailVerified === false)
            throw new common_1.UnauthorizedException('Your Google email address is not verified');
        const user = await this.userModel
            .findOneAndUpdate({ oauthLinkHash: sha256(linkToken), oauthLinkExpires: { $gt: new Date() } }, { $unset: { oauthLinkHash: 1, oauthLinkExpires: 1 } })
            .exec();
        if (!user)
            throw new common_1.UnauthorizedException('This link has expired. Please try again.');
        const owner = await this.userModel.findOne({ googleId: google.googleId }).select('_id').lean().exec();
        if (owner && String(owner._id) !== String(user._id)) {
            throw new common_1.ConflictException({ message: 'This Google account is already used by another HoroHouse account', code: 'GOOGLE_IN_USE' });
        }
        const $set = { googleId: google.googleId };
        if (!user.profilePicture && google.picture)
            $set.profilePicture = google.picture;
        await this.userModel.updateOne({ _id: user._id }, { $set });
        this.logger.log(`Google linked to user ${user._id}`);
    }
    async checkEmail(email) {
        const user = await this.userModel
            .findOne({ email: emailQuery(email) })
            .select('+password')
            .lean();
        return {
            exists: !!user,
            hasPassword: !!user?.password,
            hasGoogle: !!user?.googleId,
        };
    }
    async verifyPhone(dto) {
        try {
            const { phoneNumber, verificationCode } = dto;
            const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);
            const user = await this.userModel
                .findOne({ phoneNumber: formattedPhone })
                .select('+phoneVerificationCode +phoneVerificationAttempts');
            if (!user) {
                throw new common_1.UnauthorizedException('Invalid verification code');
            }
            await this.checkPhoneCode(user, verificationCode);
            return { message: 'Phone number verified successfully' };
        }
        catch (error) {
            this.logger.error('Phone verification failed:', error);
            throw error;
        }
    }
    async checkPhoneCode(user, code) {
        if (!user.phoneVerificationCode || !user.phoneVerificationExpires) {
            throw new common_1.UnauthorizedException('No verification code found. Please request a new one.');
        }
        if (user.phoneVerificationExpires < new Date()) {
            throw new common_1.UnauthorizedException('Verification code has expired');
        }
        if ((user.phoneVerificationAttempts ?? 0) >= MAX_CODE_ATTEMPTS) {
            throw new common_1.UnauthorizedException('Too many wrong codes. Please request a new one.');
        }
        const stored = user.phoneVerificationCode;
        const given = String(code ?? '').trim();
        const ok = stored.length === 64 ? safeEqual(stored, sha256(given)) : safeEqual(stored, given);
        if (!ok) {
            await this.userModel.updateOne({ _id: user._id }, { $inc: { phoneVerificationAttempts: 1 } });
            throw new common_1.UnauthorizedException('Invalid verification code');
        }
        user.phoneVerified = true;
        user.phoneVerificationCode = undefined;
        user.phoneVerificationExpires = undefined;
        user.phoneVerificationAttempts = 0;
        await user.save();
    }
    async refreshToken(refreshToken, req) {
        try {
            const payload = this.jwtService.verify(refreshToken, {
                secret: this.configService.get('JWT_REFRESH_SECRET'),
            });
            const user = await this.userModel.findById(payload.sub);
            if (!user || !user.isActive) {
                throw new common_1.UnauthorizedException('User not found or inactive');
            }
            const hashedIncoming = sha256(refreshToken);
            const now = Date.now();
            let session = payload?.sessionId
                ? user.sessions.find(s => s.id === payload.sessionId && s.isActive)
                : user.sessions.find(s => s.isActive && (s.refreshToken === hashedIncoming || s.refreshToken === refreshToken));
            if (!session) {
                throw new common_1.UnauthorizedException('Invalid refresh token - session not found');
            }
            const isCurrent = session.refreshToken === hashedIncoming || session.refreshToken === refreshToken;
            const isRecentPrev = session.prevRefreshToken === hashedIncoming &&
                session.rotatedAt && now - new Date(session.rotatedAt).getTime() < ROTATION_GRACE_MS;
            if (!isCurrent && !isRecentPrev) {
                this.logger.warn(`Refresh token reuse for user ${user._id}, session ${session.id}: session revoked`);
                user.sessions = user.sessions.filter(s => s.id !== session.id);
                await user.save();
                throw new common_1.UnauthorizedException('Session ended. Please log in again.');
            }
            if (session.expiresAt < new Date()) {
                user.sessions = user.sessions.filter(s => s.id !== session.id);
                await user.save();
                throw new common_1.UnauthorizedException('Session expired');
            }
            session.lastActive = new Date();
            if (req) {
                session.ipAddress = this.getClientIp(req);
                session.userAgent = req.headers['user-agent'] || 'Unknown';
            }
            const tokens = await this.generateTokens(user, req, session.id);
            return {
                ...tokens,
                user: user.toJSON(),
            };
        }
        catch (error) {
            this.logger.error('Token refresh failed:', error);
            throw new common_1.UnauthorizedException('Invalid refresh token');
        }
    }
    async validateUser(payload) {
        const user = await this.userModel.findById(payload.sub).select('+password');
        if (!user || !user.isActive) {
            throw new common_1.UnauthorizedException('User not found or inactive');
        }
        const session = user.sessions.find(s => s.id === payload.sessionId && s.isActive);
        if (!session || session.expiresAt < new Date()) {
            throw new common_1.UnauthorizedException('Session invalid or expired');
        }
        return user;
    }
    async logout(userId, sessionId) {
        try {
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new common_1.NotFoundException('User not found');
            }
            if (sessionId) {
                user.sessions = user.sessions.filter(s => s.id !== sessionId);
            }
            else {
                user.sessions = [];
            }
            await user.save();
            this.logger.log(`User logged out: ${userId}${sessionId ? ` (session: ${sessionId})` : ' (all sessions)'}`);
        }
        catch (error) {
            this.logger.error('Logout failed:', error);
        }
    }
    async changePassword(userId, currentPassword, newPassword, currentSessionId) {
        const user = await this.userModel.findById(userId).select('+password');
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (!user.password) {
            throw new common_1.BadRequestException('User does not have a password set');
        }
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new common_1.UnauthorizedException('Current password is incorrect');
        }
        const hashedNewPassword = await bcrypt.hash(newPassword, 12);
        user.password = hashedNewPassword;
        user.sessions = currentSessionId ? user.sessions.filter(s => s.id === currentSessionId) : [];
        await user.save();
        this.logger.log(`Password changed for user: ${user._id}`);
        return { message: 'Password changed successfully' };
    }
    async enable2FA(user) {
        try {
            const userId = user._id ? user._id.toString() : user.id || user.sub;
            await this.userModel.findByIdAndUpdate(userId, {
                twoFactorEnabled: true
            });
            this.logger.log(`2FA enabled for user: ${userId}`);
            return { message: 'Two-factor authentication enabled successfully' };
        }
        catch (error) {
            this.logger.error('2FA enable failed:', error);
            throw error;
        }
    }
    async disable2FA(user) {
        try {
            const userId = user._id ? user._id.toString() : user.id || user.sub;
            await this.userModel.findByIdAndUpdate(userId, {
                twoFactorEnabled: false,
                twoFactorSecret: undefined
            });
            this.logger.log(`2FA disabled for user: ${userId}`);
            return { message: 'Two-factor authentication disabled successfully' };
        }
        catch (error) {
            this.logger.error('2FA disable failed:', error);
            throw error;
        }
    }
    async getUserSessions(user) {
        try {
            const userId = user._id ? user._id.toString() : user.id || user.sub;
            const userDoc = await this.userModel.findById(userId);
            if (!userDoc) {
                throw new common_1.NotFoundException('User not found');
            }
            const now = new Date();
            const activeSessions = userDoc.sessions.filter(session => session.isActive && session.expiresAt > now);
            if (activeSessions.length !== userDoc.sessions.length) {
                userDoc.sessions = activeSessions;
                await userDoc.save();
            }
            const plainSessions = userDoc.toObject().sessions;
            return plainSessions.map((session) => ({
                ...session,
                device: !session.device || /unknown/i.test(session.device)
                    ? AuthService_1.deviceFromUserAgent(session.userAgent)
                    : session.device,
                location: session.location && !/unknown|local network/i.test(session.location) ? session.location : undefined,
                refreshToken: undefined,
                prevRefreshToken: undefined,
                ipAddress: undefined,
                userAgent: undefined,
            }));
        }
        catch (error) {
            this.logger.error('Get sessions failed:', error);
            throw error;
        }
    }
    async terminateSession(user, sessionId) {
        try {
            const userId = user._id ? user._id.toString() : user.id || user.sub;
            const userDoc = await this.userModel.findById(userId);
            if (!userDoc) {
                throw new common_1.NotFoundException('User not found');
            }
            const originalSessionCount = userDoc.sessions.length;
            userDoc.sessions = userDoc.sessions.filter(s => s.id !== sessionId);
            if (userDoc.sessions.length === originalSessionCount) {
                throw new common_1.NotFoundException('Session not found');
            }
            await userDoc.save();
            this.logger.log(`Session ${sessionId} terminated for user: ${userId}`);
            return { message: 'Session terminated successfully' };
        }
        catch (error) {
            this.logger.error('Session termination failed:', error);
            throw error;
        }
    }
    async terminateAllSessions(user, currentSessionId) {
        try {
            const userId = user._id ? user._id.toString() : user.id || user.sub;
            const userDoc = await this.userModel.findById(userId);
            if (!userDoc) {
                throw new common_1.NotFoundException('User not found');
            }
            if (currentSessionId) {
                userDoc.sessions = userDoc.sessions.filter(s => s.id === currentSessionId);
            }
            else {
                userDoc.sessions = [];
            }
            await userDoc.save();
            this.logger.log(`All other sessions terminated for user: ${userId}`);
            return { message: 'All other sessions terminated successfully' };
        }
        catch (error) {
            this.logger.error('All sessions termination failed:', error);
            throw error;
        }
    }
    async resendEmailVerification(user) {
        try {
            const userId = user._id ? user._id.toString() : user.id || user.sub;
            const doc = await this.userModel.findById(userId);
            if (!doc)
                throw new common_1.NotFoundException('User not found');
            if (!doc.email) {
                throw new common_1.BadRequestException('User does not have an email address');
            }
            if (doc.emailVerified) {
                throw new common_1.BadRequestException('Email is already verified');
            }
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            await this.userModel.findByIdAndUpdate(userId, {
                emailVerificationToken: verificationToken,
                emailVerificationExpires: expiresAt
            });
            await this.emailService.sendEmailVerification(doc.email, doc.name, verificationToken);
            this.logger.log(`Email verification resent to user ${userId}`);
            return { message: 'Verification email sent successfully' };
        }
        catch (error) {
            this.logger.error('Email verification resend failed:', error);
            throw error;
        }
    }
    async resendPhoneVerification(user) {
        try {
            if (user.phoneVerified) {
                throw new common_1.BadRequestException('Phone number is already verified');
            }
            if (isPlaceholderPhone(user.phoneNumber)) {
                throw new common_1.BadRequestException('Add a phone number to your profile first');
            }
            const verificationCode = this.smsService.generateVerificationCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            const userId = user._id ? user._id.toString() : user.id || user.sub;
            await this.userModel.findByIdAndUpdate(userId, {
                phoneVerificationCode: sha256(String(verificationCode)),
                phoneVerificationExpires: expiresAt,
                phoneVerificationSentAt: new Date(),
                phoneVerificationAttempts: 0,
            });
            const smsSent = await this.smsService.sendVerificationCode(user.phoneNumber, verificationCode);
            if (!smsSent) {
                throw new common_1.BadRequestException('Failed to send verification code');
            }
            this.logger.log(`Phone verification resent to user ${userId}`);
            return { message: 'Verification code sent successfully' };
        }
        catch (error) {
            this.logger.error('Phone verification resend failed:', error);
            throw error;
        }
    }
    async verifyEmail(token) {
        try {
            const user = await this.userModel.findOne({
                emailVerificationToken: token,
                emailVerificationExpires: { $gt: Date.now() }
            });
            if (!user) {
                throw new common_1.UnauthorizedException('Invalid or expired verification token');
            }
            user.emailVerified = true;
            user.emailVerificationToken = undefined;
            user.emailVerificationExpires = undefined;
            await user.save();
            this.logger.log(`Email verified for user: ${user._id}`);
            return { message: 'Email verified successfully' };
        }
        catch (error) {
            this.logger.error('Email verification failed:', error);
            throw error;
        }
    }
    async requestPasswordReset(email) {
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const user = await this.userModel.findOne({ email: emailQuery(normalizedEmail) });
            if (!user || !user.isActive) {
                this.logger.log('Password reset requested for an unknown or inactive email');
                return { message: 'If an account exists with this email, you will receive a password reset link shortly.' };
            }
            const resetToken = crypto.randomBytes(32).toString('hex');
            const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            user.resetPasswordToken = hashedToken;
            user.resetPasswordExpires = expiresAt;
            await user.save();
            this.logger.log(`Password reset token generated for user: ${user._id}`);
            try {
                await this.emailService.sendPasswordResetEmail(user.email, user.name, resetToken);
            }
            catch (error) {
                this.logger.error('Failed to send password reset email:', error);
            }
            return { message: 'If an account exists with this email, you will receive a password reset link shortly.' };
        }
        catch (error) {
            this.logger.error('Password reset request failed:', error);
            throw new common_1.BadRequestException('Failed to process password reset request');
        }
    }
    async validateResetToken(token) {
        try {
            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
            const user = await this.userModel.findOne({
                resetPasswordToken: hashedToken,
                resetPasswordExpires: { $gt: new Date() }
            });
            if (!user) {
                return { valid: false };
            }
            return {
                valid: true,
                email: user.email
            };
        }
        catch (error) {
            this.logger.error('Token validation failed:', error);
            return { valid: false };
        }
    }
    async resetPassword(token, newPassword) {
        try {
            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
            const user = await this.userModel.findOne({
                resetPasswordToken: hashedToken,
                resetPasswordExpires: { $gt: new Date() }
            }).select('+password +resetPasswordToken');
            if (!user) {
                throw new common_1.UnauthorizedException('Invalid or expired password reset token');
            }
            const hashedPassword = await bcrypt.hash(newPassword, 12);
            user.password = hashedPassword;
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;
            user.sessions = [];
            await user.save();
            this.logger.log(`Password reset successfully for user: ${user._id}`);
            try {
                await this.emailService.sendPasswordResetConfirmation(user.email, user.name);
            }
            catch (error) {
                this.logger.error('Failed to send password reset confirmation:', error);
            }
            return { message: 'Password has been reset successfully. You can now sign in with your new password.' };
        }
        catch (error) {
            if (error instanceof common_1.UnauthorizedException) {
                throw error;
            }
            this.logger.error('Password reset failed:', error);
            throw new common_1.BadRequestException('Failed to reset password');
        }
    }
    async generateTokens(user, req, existingSessionId) {
        const sessionId = existingSessionId || crypto.randomUUID();
        const payload = {
            sub: user._id.toString(),
            phoneNumber: user.phoneNumber,
            email: user.email,
            role: user.role,
            sessionId,
            onboardingStatus: user.onboardingStatus,
            onboardingCompleted: user.onboardingCompleted ?? (user.onboardingStatus === user_schema_1.OnboardingStatus.COMPLETED),
        };
        const accessTokenOptions = {
            secret: this.configService.get('JWT_SECRET'),
            expiresIn: Math.floor(this.parseTokenExpiration(this.configService.get('JWT_EXPIRATION', '1h')) / 1000),
        };
        const refreshTokenOptions = {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: Math.floor(this.parseTokenExpiration(this.configService.get('JWT_REFRESH_EXPIRATION', '7d')) / 1000),
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, accessTokenOptions),
            this.jwtService.signAsync(payload, { ...refreshTokenOptions, jwtid: crypto.randomUUID() }),
        ]);
        if (!existingSessionId) {
            const refreshTokenExpirationTime = this.configService.get('JWT_REFRESH_EXPIRATION', '7d');
            const expirationMs = this.parseTokenExpiration(refreshTokenExpirationTime);
            const expiresAt = new Date(Date.now() + expirationMs);
            const deviceInfo = req?.body?.deviceInfo || {};
            const userAgent = req?.headers?.['user-agent'] || 'Unknown';
            const ipAddress = this.getClientIp(req);
            const hashedRefreshToken = sha256(refreshToken);
            const newSession = {
                id: sessionId,
                refreshToken: hashedRefreshToken,
                device: this.parseDeviceInfo(userAgent, deviceInfo),
                ipAddress,
                userAgent,
                location: await this.getLocationFromIp(ipAddress),
                isActive: true,
                lastActive: new Date(),
                createdAt: new Date(),
                expiresAt,
            };
            user.sessions.push(newSession);
            const now = new Date();
            user.sessions = user.sessions.filter(session => session.expiresAt > now);
            if (user.sessions.length > 10) {
                user.sessions = user.sessions
                    .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime())
                    .slice(0, 10);
            }
            await user.save();
        }
        else {
            const sessionIndex = user.sessions.findIndex(s => s.id === existingSessionId);
            if (sessionIndex !== -1) {
                const sess = user.sessions[sessionIndex];
                const prev = sess.refreshToken;
                sess.prevRefreshToken = prev && prev.length === 64 ? prev : sha256(prev || '');
                sess.rotatedAt = new Date();
                sess.refreshToken = sha256(refreshToken);
                sess.lastActive = new Date();
                if (req && (!sess.location || /unknown|local network/i.test(sess.location))) {
                    sess.ipAddress = this.getClientIp(req);
                    sess.location = await this.getLocationFromIp(sess.ipAddress);
                }
                sess.expiresAt = new Date(Date.now() + this.parseTokenExpiration(this.configService.get('JWT_REFRESH_EXPIRATION', '7d')));
                user.markModified('sessions');
                await user.save();
            }
        }
        return { accessToken, refreshToken };
    }
    getClientIp(req) {
        if (!req)
            return 'Unknown';
        const fwd = req.headers?.['x-forwarded-for'];
        const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
        return first ||
            req.headers?.['x-real-ip'] ||
            req.ip ||
            req.socket?.remoteAddress ||
            'Unknown';
    }
    parseDeviceInfo(userAgent, deviceInfo) {
        if (typeof deviceInfo?.device === 'string' && deviceInfo.device.trim()) {
            return deviceInfo.device.replace(/[^\p{L}\p{N} .,'’()·+_-]/gu, '').trim().slice(0, 80) || 'HoroHouse app';
        }
        return AuthService_1.deviceFromUserAgent(userAgent);
    }
    static deviceFromUserAgent(userAgent) {
        const ua = String(userAgent ?? '').toLowerCase();
        if (ua.startsWith('okhttp') || (ua.includes('android') && !ua.includes('mozilla')))
            return 'Android phone · HoroHouse app';
        if (ua.includes('cfnetwork') || ua.includes('darwin'))
            return 'iPhone · HoroHouse app';
        if (ua.includes('expo'))
            return 'HoroHouse app';
        let browser = '';
        let os = '';
        if (ua.includes('edg/'))
            browser = 'Edge';
        else if (ua.includes('opr/') || ua.includes('opera'))
            browser = 'Opera';
        else if (ua.includes('chrome'))
            browser = 'Chrome';
        else if (ua.includes('firefox'))
            browser = 'Firefox';
        else if (ua.includes('safari'))
            browser = 'Safari';
        if (ua.includes('windows'))
            os = 'Windows';
        else if (ua.includes('macintosh') || ua.includes('mac os x'))
            os = 'macOS';
        else if (ua.includes('linux'))
            os = 'Linux';
        else if (ua.includes('android'))
            os = 'Android';
        else if (ua.includes('iphone') || ua.includes('ipad'))
            os = 'iOS';
        if (ua.includes('android'))
            os = 'Android';
        if (browser && os)
            return `${browser} · ${os}`;
        return browser || os || 'Unknown device';
    }
    static geoCache = new Map();
    async getLocationFromIp(ipAddress) {
        const ip = String(ipAddress ?? '').replace(/^::ffff:/, '');
        if (!ip || ip === 'Unknown' || this.configService.get('SESSION_GEOIP') === 'off')
            return '';
        if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.)/.test(ip) || ip === '::1' || /^f[cd]/i.test(ip))
            return '';
        const hit = AuthService_1.geoCache.get(ip);
        if (hit && Date.now() - hit.at < 24 * 3600_000)
            return hit.value;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1500);
        try {
            const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,country`, { signal: ctrl.signal });
            const data = await res.json();
            const value = data?.status === 'success' ? [data.city, data.country].filter(Boolean).join(', ').slice(0, 80) : '';
            if (AuthService_1.geoCache.size > 5000)
                AuthService_1.geoCache.clear();
            AuthService_1.geoCache.set(ip, { at: Date.now(), value });
            return value;
        }
        catch {
            return '';
        }
        finally {
            clearTimeout(timer);
        }
    }
    parseTokenExpiration(expiration) {
        const regex = /^(\d+)([smhd])$/;
        const match = expiration.match(regex);
        if (!match) {
            return 7 * 24 * 60 * 60 * 1000;
        }
        const [, value, unit] = match;
        const num = parseInt(value, 10);
        switch (unit) {
            case 's': return num * 1000;
            case 'm': return num * 60 * 1000;
            case 'h': return num * 60 * 60 * 1000;
            case 'd': return num * 24 * 60 * 60 * 1000;
            default: return 7 * 24 * 60 * 60 * 1000;
        }
    }
    async cleanupExpiredSessions() {
        try {
            const now = new Date();
            await this.userModel.updateMany({ 'sessions.expiresAt': { $lt: now } }, { $pull: { sessions: { expiresAt: { $lt: now } } } });
            this.logger.log('Expired sessions cleaned up');
        }
        catch (error) {
            this.logger.error('Failed to cleanup expired sessions:', error);
        }
    }
    async deactivateAccount(userId) {
        try {
            const user = await this.userModel.findById(userId);
            if (!user) {
                throw new common_1.NotFoundException('User not found');
            }
            user.isActive = false;
            user.sessions = [];
            await user.save();
            try {
                const Property = this.userModel.db.model('Property');
                const res = await Property.updateMany({ ownerId: user._id, isActive: true }, { $set: { isActive: false } }).exec();
                if (res.modifiedCount)
                    this.logger.log(`Hid ${res.modifiedCount} listing(s) of deactivated user ${userId}`);
            }
            catch (e) {
                this.logger.warn(`Could not hide listings of deactivated user ${userId}: ${e?.message}`);
            }
            this.logger.log(`Account deactivated by user: ${userId}`);
            return { message: 'Account deactivated successfully' };
        }
        catch (error) {
            this.logger.error('Account deactivation failed:', error);
            throw error;
        }
    }
    async disconnectGoogle(userId) {
        try {
            const user = await this.userModel.findById(userId).select('+password');
            if (!user) {
                throw new common_1.NotFoundException('User not found');
            }
            if (!user.password) {
                throw new common_1.BadRequestException('You must set a password before disconnecting Google to avoid losing account access.');
            }
            await this.userModel.findByIdAndUpdate(userId, {
                $unset: { googleId: '' },
            });
            this.logger.log(`Google disconnected for user: ${userId}`);
            return { message: 'Google account disconnected successfully' };
        }
        catch (error) {
            this.logger.error('Google disconnect failed:', error);
            throw error;
        }
    }
    static ONBOARDING_SELF_ASSIGNABLE_ROLES = [
        user_schema_1.UserRole.REGISTERED_USER,
        user_schema_1.UserRole.HOST,
        user_schema_1.UserRole.LANDLORD,
        user_schema_1.UserRole.AGENT,
    ];
    async getGoogleOnboardingStatus(userId) {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const hasRealPhone = user.phoneNumber && !user.phoneNumber.startsWith('google_') && !user.phoneNumber.startsWith('temp_');
        return {
            onboardingStatus: onboardingDone(user) ? user_schema_1.OnboardingStatus.COMPLETED
                : user.onboardingStatus === user_schema_1.OnboardingStatus.COMPLETED ? user_schema_1.OnboardingStatus.NOT_STARTED : user.onboardingStatus,
            role: user.role,
            phoneNumber: hasRealPhone ? user.phoneNumber : null,
            name: user.name,
            email: user.email || null,
            profilePicture: user.profilePicture || null,
        };
    }
    async selectOnboardingRole(userId, role) {
        if (!AuthService_1.ONBOARDING_SELF_ASSIGNABLE_ROLES.includes(role)) {
            throw new common_1.BadRequestException(`Invalid role. Allowed roles: ${AuthService_1.ONBOARDING_SELF_ASSIGNABLE_ROLES.join(', ')}`);
        }
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (onboardingDone(user)) {
            throw new common_1.BadRequestException('Onboarding is already completed. Role cannot be changed here.');
        }
        user.role = role;
        user.onboardingStatus = user_schema_1.OnboardingStatus.ROLE_SELECTED;
        await user.save();
        this.logger.log(`Onboarding role selected for user ${userId}: ${role}`);
        return {
            onboardingStatus: user.onboardingStatus,
            role: user.role,
        };
    }
    async setOnboardingPhone(userId, phoneNumber) {
        if (!this.smsService.isValidPhoneNumber(phoneNumber)) {
            throw new common_1.BadRequestException('Invalid phone number format. Use E.164 format (e.g. +237612345678).');
        }
        const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (onboardingDone(user)) {
            throw new common_1.BadRequestException('Onboarding is already completed.');
        }
        if (user.onboardingStatus === user_schema_1.OnboardingStatus.NOT_STARTED) {
            throw new common_1.BadRequestException('Please select a role before providing a phone number.');
        }
        const existingUser = await this.userModel.findOne({
            _id: { $ne: user._id },
            phoneNumber: formattedPhone,
        });
        if (existingUser) {
            throw new common_1.ConflictException('This phone number is already registered to another account.');
        }
        user.phoneNumber = formattedPhone;
        user.phoneVerified = false;
        user.onboardingStatus = user_schema_1.OnboardingStatus.PHONE_PROVIDED;
        await user.save();
        this.logger.log(`Onboarding phone set for user ${userId}: ${formattedPhone}`);
        return {
            onboardingStatus: user.onboardingStatus,
            phoneNumber: formattedPhone,
        };
    }
    async completeGoogleOnboarding(userId, req, currentSessionId) {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (onboardingDone(user)) {
            throw new common_1.BadRequestException('Onboarding is already completed.');
        }
        const hasValidRole = AuthService_1.ONBOARDING_SELF_ASSIGNABLE_ROLES.includes(user.role);
        const hasRealPhone = user.phoneNumber && !user.phoneNumber.startsWith('google_') && !user.phoneNumber.startsWith('temp_');
        if (!hasValidRole) {
            throw new common_1.BadRequestException('Please select a valid role before completing onboarding.');
        }
        if (!hasRealPhone) {
            throw new common_1.BadRequestException('Please provide a valid phone number before completing onboarding.');
        }
        user.onboardingStatus = user_schema_1.OnboardingStatus.COMPLETED;
        user.onboardingCompleted = true;
        await user.save();
        this.logger.log(`Google onboarding completed for user ${userId}`);
        const hasSession = !!currentSessionId && user.sessions.some(s => s.id === currentSessionId && s.isActive);
        const tokens = await this.generateTokens(user, req, hasSession ? currentSessionId : undefined);
        return {
            ...tokens,
            user: user.toJSON(),
            onboardingStatus: user_schema_1.OnboardingStatus.COMPLETED,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        sms_service_1.SmsService,
        email_service_1.EmailService,
        jwt_1.JwtService,
        config_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map