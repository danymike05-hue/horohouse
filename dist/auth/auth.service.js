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
let AuthService = class AuthService {
    static { AuthService_1 = this; }
    userModel;
    smsService;
    emailService;
    jwtService;
    configService;
    logger = new common_1.Logger(AuthService_1.name);
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
            const verificationCode = this.smsService.generateVerificationCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            await this.userModel.updateOne({ phoneNumber: formattedPhone }, {
                phoneVerificationCode: verificationCode,
                phoneVerificationExpires: expiresAt,
                phoneVerificationSentAt: new Date(),
            }, { upsert: true, setDefaultsOnInsert: true });
            const smsSent = await this.smsService.sendVerificationCode(formattedPhone, verificationCode);
            if (!smsSent) {
                throw new common_1.BadRequestException('Failed to send verification code');
            }
            this.logger.log(`Verification code sent to ${formattedPhone}`);
            return { message: 'Verification code sent successfully' };
        }
        catch (error) {
            this.logger.error('Failed to send phone verification code:', error);
            throw error;
        }
    }
    async registerWithPhone(dto, req) {
        try {
            const { name, phoneNumber, email, role } = dto;
            const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);
            const existingUser = await this.userModel.findOne({
                $or: [
                    { phoneNumber: formattedPhone },
                    ...(email ? [{ email }] : [])
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
            this.logger.log(`New user registered with phone: ${formattedPhone}`);
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
            const existingUser = await this.userModel.findOne({
                $or: [
                    { email: { $regex: `^${normalizedEmail}$`, $options: 'i' } },
                    ...(phoneNumber ? [{ phoneNumber }] : [])
                ]
            });
            if (existingUser) {
                throw new common_1.ConflictException('User already exists with this email or phone number');
            }
            const hashedPassword = await bcrypt.hash(password, 12);
            const user = await this.userModel.create({
                name,
                email: normalizedEmail,
                password: hashedPassword,
                phoneNumber: phoneNumber || `temp_${Date.now()}`,
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
            const user = await this.userModel.findOne({ phoneNumber: formattedPhone });
            if (!user) {
                throw new common_1.UnauthorizedException('User not found');
            }
            if (!user.phoneVerificationCode || !user.phoneVerificationExpires) {
                throw new common_1.UnauthorizedException('No verification code found. Please request a new one.');
            }
            if (user.phoneVerificationExpires < new Date()) {
                throw new common_1.UnauthorizedException('Verification code has expired');
            }
            if (user.phoneVerificationCode !== verificationCode) {
                throw new common_1.UnauthorizedException('Invalid verification code');
            }
            user.phoneVerified = true;
            user.phoneVerificationCode = undefined;
            user.phoneVerificationExpires = undefined;
            await user.save();
            this.logger.log(`User logged in with phone: ${formattedPhone}`);
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
            const user = await this.userModel.findOne({
                email: { $regex: `^${normalizedEmail}$`, $options: 'i' }
            });
            if (!user) {
                this.logger.error(`Email login failed: user not found for email ${normalizedEmail}`);
                throw new common_1.UnauthorizedException('Invalid credentials');
            }
            if (!user.password) {
                this.logger.error(`Email login failed: no password set for email ${normalizedEmail}`);
                throw new common_1.UnauthorizedException('Invalid credentials');
            }
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                this.logger.error(`Email login failed: wrong password for email ${normalizedEmail}`);
                throw new common_1.UnauthorizedException('Invalid credentials');
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
    async googleAuth(dto, req) {
        try {
            const { googleId, email, name, picture } = dto;
            let user = await this.userModel.findOne({
                $or: [{ googleId }, { email }]
            });
            let isNewUser = false;
            if (!user) {
                isNewUser = true;
                user = await this.userModel.create({
                    googleId,
                    name,
                    email,
                    profilePicture: picture,
                    phoneNumber: `google_${Date.now()}`,
                    role: user_schema_1.UserRole.REGISTERED_USER,
                    emailVerified: true,
                    phoneVerified: false,
                    onboardingCompleted: false,
                    onboardingStatus: user_schema_1.OnboardingStatus.NOT_STARTED,
                });
                this.logger.log(`New user created via Google OAuth: ${email}`);
                if (user.email) {
                    void this.emailService.sendWelcomeEmail(user.email, user.name).catch(() => undefined);
                }
            }
            else {
                if (!user.googleId)
                    user.googleId = googleId;
                if (!user.profilePicture && picture)
                    user.profilePicture = picture;
                user.emailVerified = true;
                const hasPlaceholderPhone = !user.phoneNumber ||
                    user.phoneNumber.startsWith('google_') ||
                    user.phoneNumber.startsWith('temp_');
                const explicitlyCompleted = user.onboardingStatus === user_schema_1.OnboardingStatus.COMPLETED ||
                    user.onboardingCompleted === true;
                const implicitlyCompleted = !hasPlaceholderPhone &&
                    user.role !== user_schema_1.UserRole.REGISTERED_USER &&
                    AuthService_1.ONBOARDING_SELF_ASSIGNABLE_ROLES.includes(user.role);
                const alreadyCompleted = explicitlyCompleted || implicitlyCompleted;
                if (alreadyCompleted) {
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
                this.logger.log(`Existing user logged in via Google OAuth: ${email}, onboardingStatus: ${user.onboardingStatus}`);
            }
            const tokens = await this.generateTokens(user, req);
            return {
                ...tokens,
                user: user.toJSON(),
                isNewUser,
                onboardingStatus: user.onboardingStatus,
            };
        }
        catch (error) {
            this.logger.error('Google OAuth failed:', error);
            throw error;
        }
    }
    async verifyPhone(dto) {
        try {
            const { phoneNumber, verificationCode } = dto;
            const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);
            const user = await this.userModel.findOne({ phoneNumber: formattedPhone });
            if (!user) {
                throw new common_1.UnauthorizedException('User not found');
            }
            if (!user.phoneVerificationCode || !user.phoneVerificationExpires) {
                throw new common_1.UnauthorizedException('No verification code found');
            }
            if (user.phoneVerificationExpires < new Date()) {
                throw new common_1.UnauthorizedException('Verification code has expired');
            }
            if (user.phoneVerificationCode !== verificationCode) {
                throw new common_1.UnauthorizedException('Invalid verification code');
            }
            user.phoneVerified = true;
            user.phoneVerificationCode = undefined;
            user.phoneVerificationExpires = undefined;
            await user.save();
            return { message: 'Phone number verified successfully' };
        }
        catch (error) {
            this.logger.error('Phone verification failed:', error);
            throw error;
        }
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
            let session = undefined;
            if (payload && payload.sessionId) {
                session = user.sessions.find(s => s.id === payload.sessionId && s.isActive);
                if (!session) {
                    this.logger.warn(`Refresh attempt for user ${user._id} provided sessionId ${payload.sessionId} but no active session was found`);
                }
            }
            const hashedIncoming = crypto.createHash('sha256').update(refreshToken).digest('hex');
            if (!session) {
                session = user.sessions.find(s => s.refreshToken === hashedIncoming && s.isActive);
            }
            if (!session) {
                this.logger.error(`Invalid refresh token for user ${user._id}: session not found (payload.sessionId=${payload?.sessionId})`);
                throw new common_1.UnauthorizedException('Invalid refresh token - session not found');
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
            await user.save();
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
    async changePassword(userId, currentPassword, newPassword) {
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
                refreshToken: undefined,
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
            if (!user.email) {
                throw new common_1.BadRequestException('User does not have an email address');
            }
            if (user.emailVerified) {
                throw new common_1.BadRequestException('Email is already verified');
            }
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const userId = user._id ? user._id.toString() : user.id || user.sub;
            await this.userModel.findByIdAndUpdate(userId, {
                emailVerificationToken: verificationToken,
                emailVerificationExpires: expiresAt
            });
            this.logger.log(`Email verification resent to: ${user.email}`);
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
            const verificationCode = this.smsService.generateVerificationCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            const userId = user._id ? user._id.toString() : user.id || user.sub;
            await this.userModel.findByIdAndUpdate(userId, {
                phoneVerificationCode: verificationCode,
                phoneVerificationExpires: expiresAt
            });
            const smsSent = await this.smsService.sendVerificationCode(user.phoneNumber, verificationCode);
            if (!smsSent) {
                throw new common_1.BadRequestException('Failed to send verification code');
            }
            this.logger.log(`Phone verification resent to: ${user.phoneNumber}`);
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
            const user = await this.userModel.findOne({
                email: { $regex: `^${normalizedEmail}$`, $options: 'i' }
            });
            if (!user) {
                this.logger.log(`Password reset requested for non-existent email: ${normalizedEmail}`);
                return { message: 'If an account exists with this email, you will receive a password reset link shortly.' };
            }
            if (!user.password) {
                this.logger.log(`Password reset requested for OAuth-only user: ${normalizedEmail}`);
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
            });
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
            expiresIn: this.parseTokenExpiration(this.configService.get('JWT_EXPIRATION', '1h')),
        };
        const refreshTokenOptions = {
            secret: this.configService.get('JWT_REFRESH_SECRET'),
            expiresIn: this.parseTokenExpiration(this.configService.get('JWT_REFRESH_EXPIRATION', '7d')),
        };
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, accessTokenOptions),
            this.jwtService.signAsync(payload, refreshTokenOptions),
        ]);
        if (!existingSessionId) {
            const refreshTokenExpirationTime = this.configService.get('JWT_REFRESH_EXPIRATION', '7d');
            const expirationMs = this.parseTokenExpiration(refreshTokenExpirationTime);
            const expiresAt = new Date(Date.now() + expirationMs);
            const deviceInfo = req?.body?.deviceInfo || {};
            const userAgent = req?.headers?.['user-agent'] || 'Unknown';
            const ipAddress = this.getClientIp(req);
            const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
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
                user.sessions[sessionIndex].refreshToken = refreshToken;
                user.sessions[sessionIndex].lastActive = new Date();
                await user.save();
            }
        }
        return { accessToken, refreshToken };
    }
    getClientIp(req) {
        if (!req)
            return 'Unknown';
        return req.ip ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            (req.headers && (req.headers['x-forwarded-for']?.split(',')[0] ||
                req.headers['x-real-ip'] ||
                req.headers['x-client-ip'])) ||
            'Unknown';
    }
    parseDeviceInfo(userAgent, deviceInfo) {
        if (deviceInfo?.device) {
            return deviceInfo.device;
        }
        const ua = userAgent.toLowerCase();
        let browser = 'Unknown Browser';
        let os = 'Unknown OS';
        if (ua.includes('chrome'))
            browser = 'Chrome';
        else if (ua.includes('firefox'))
            browser = 'Firefox';
        else if (ua.includes('safari'))
            browser = 'Safari';
        else if (ua.includes('edge'))
            browser = 'Edge';
        else if (ua.includes('opera'))
            browser = 'Opera';
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
        return `${browser} on ${os}`;
    }
    async getLocationFromIp(ipAddress) {
        if (ipAddress === 'Unknown' || ipAddress.startsWith('127.') || ipAddress.startsWith('192.168.')) {
            return 'Local Network';
        }
        return 'Unknown Location';
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
            onboardingStatus: user.onboardingStatus,
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
        if (user.onboardingStatus === user_schema_1.OnboardingStatus.COMPLETED) {
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
        if (user.onboardingStatus === user_schema_1.OnboardingStatus.COMPLETED) {
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
    async completeGoogleOnboarding(userId) {
        const user = await this.userModel.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (user.onboardingStatus === user_schema_1.OnboardingStatus.COMPLETED) {
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
        const tokens = await this.generateTokens(user);
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