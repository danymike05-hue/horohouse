import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { SmsService } from './sms.service';
import { EmailService } from '../email/email.service';
import { User, UserDocument, UserRole, UserSession, OnboardingStatus } from '../users/schemas/user.schema';
export interface JwtPayload {
    sub: string;
    phoneNumber: string;
    email?: string;
    role: UserRole;
    sessionId: string;
    onboardingStatus?: OnboardingStatus;
    onboardingCompleted?: boolean;
    iat?: number;
    exp?: number;
}
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
    isNewUser?: boolean;
    onboardingStatus?: string;
}
export interface RegisterWithPhoneDto {
    name: string;
    phoneNumber: string;
    email?: string;
    role?: UserRole;
    deviceInfo?: any;
}
export interface RegisterWithEmailDto {
    name: string;
    email: string;
    password: string;
    phoneNumber?: string;
    role?: UserRole;
    deviceInfo?: any;
}
export interface LoginWithPhoneDto {
    phoneNumber: string;
    verificationCode: string;
    deviceInfo?: any;
}
export interface LoginWithEmailDto {
    email: string;
    password: string;
    deviceInfo?: any;
}
export interface SendPhoneCodeDto {
    phoneNumber: string;
}
export interface VerifyPhoneDto {
    phoneNumber: string;
    verificationCode: string;
}
export interface GoogleAuthDto {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
    deviceInfo?: any;
}
export declare class AuthService {
    private userModel;
    private smsService;
    private emailService;
    private jwtService;
    private configService;
    private readonly logger;
    private static readonly SELF_ASSIGNABLE_ROLES;
    private resolveSelfAssignableRole;
    constructor(userModel: Model<UserDocument>, smsService: SmsService, emailService: EmailService, jwtService: JwtService, configService: ConfigService);
    sendPhoneVerificationCode(dto: SendPhoneCodeDto): Promise<{
        message: string;
    }>;
    registerWithPhone(dto: RegisterWithPhoneDto, req?: any): Promise<AuthTokens>;
    registerWithEmail(dto: RegisterWithEmailDto, req?: any): Promise<AuthTokens>;
    loginWithPhone(dto: LoginWithPhoneDto, req?: any): Promise<AuthTokens>;
    loginWithEmail(dto: LoginWithEmailDto, req?: any): Promise<AuthTokens>;
    googleAuth(dto: GoogleAuthDto, req?: any): Promise<AuthTokens>;
    verifyPhone(dto: VerifyPhoneDto): Promise<{
        message: string;
    }>;
    refreshToken(refreshToken: string, req?: any): Promise<AuthTokens>;
    validateUser(payload: JwtPayload): Promise<UserDocument>;
    logout(userId: string, sessionId?: string): Promise<void>;
    changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{
        message: string;
    }>;
    enable2FA(user: User): Promise<{
        message: string;
        secret?: string;
    }>;
    disable2FA(user: User): Promise<{
        message: string;
    }>;
    getUserSessions(user: User): Promise<UserSession[]>;
    terminateSession(user: User, sessionId: string): Promise<{
        message: string;
    }>;
    terminateAllSessions(user: User, currentSessionId?: string): Promise<{
        message: string;
    }>;
    resendEmailVerification(user: User): Promise<{
        message: string;
    }>;
    resendPhoneVerification(user: User): Promise<{
        message: string;
    }>;
    verifyEmail(token: string): Promise<{
        message: string;
    }>;
    requestPasswordReset(email: string): Promise<{
        message: string;
    }>;
    validateResetToken(token: string): Promise<{
        valid: boolean;
        email?: string;
    }>;
    resetPassword(token: string, newPassword: string): Promise<{
        message: string;
    }>;
    private generateTokens;
    private getClientIp;
    private parseDeviceInfo;
    private getLocationFromIp;
    private parseTokenExpiration;
    cleanupExpiredSessions(): Promise<void>;
    deactivateAccount(userId: string): Promise<{
        message: string;
    }>;
    disconnectGoogle(userId: string): Promise<{
        message: string;
    }>;
    private static readonly ONBOARDING_SELF_ASSIGNABLE_ROLES;
    getGoogleOnboardingStatus(userId: string): Promise<{
        onboardingStatus: OnboardingStatus;
        role: UserRole;
        phoneNumber: string | null;
        name: string;
        email: string | null;
        profilePicture: string | null;
    }>;
    selectOnboardingRole(userId: string, role: UserRole): Promise<{
        onboardingStatus: OnboardingStatus;
        role: UserRole;
    }>;
    setOnboardingPhone(userId: string, phoneNumber: string): Promise<{
        onboardingStatus: OnboardingStatus;
        phoneNumber: string;
    }>;
    completeGoogleOnboarding(userId: string): Promise<AuthTokens>;
}
