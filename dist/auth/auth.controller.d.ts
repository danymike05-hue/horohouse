import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, AuthTokens, RegisterWithPhoneDto, RegisterWithEmailDto, LoginWithPhoneDto, LoginWithEmailDto, SendPhoneCodeDto, VerifyPhoneDto, JwtPayload } from './auth.service';
import { User, UserRole } from '../users/schemas/user.schema';
import { ForgotPasswordDto, ResetPasswordDto, ValidateResetTokenDto } from './dto/password-reset.dto';
import { SelectRoleDto, SetPhoneDto } from './dto/google-onboarding.dto';
declare class RefreshTokenDto {
    refreshToken: string;
}
declare module 'fastify' {
    interface FastifyRequest {
        user?: User | JwtPayload;
    }
}
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    private setAuthCookies;
    private clearAuthCookies;
    sendPhoneCode(dto: SendPhoneCodeDto): Promise<{
        message: string;
    }>;
    registerWithPhone(dto: RegisterWithPhoneDto, req: FastifyRequest, res: FastifyReply): Promise<AuthTokens>;
    registerWithEmail(dto: RegisterWithEmailDto, req: FastifyRequest, res: FastifyReply): Promise<AuthTokens>;
    loginWithPhone(dto: LoginWithPhoneDto, req: FastifyRequest, res: FastifyReply): Promise<AuthTokens>;
    loginWithEmail(dto: LoginWithEmailDto, req: FastifyRequest, res: FastifyReply): Promise<AuthTokens>;
    verifyPhone(dto: VerifyPhoneDto): Promise<{
        message: string;
    }>;
    refreshToken(body: Partial<RefreshTokenDto>, req: FastifyRequest & {
        cookies?: Record<string, string>;
    }, res: FastifyReply): Promise<AuthTokens>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    validateResetToken(dto: ValidateResetTokenDto): Promise<{
        valid: boolean;
        email?: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    googleAuth(): Promise<void>;
    googleAuthRedirect(req: FastifyRequest, res: FastifyReply): Promise<never>;
    logout(req: FastifyRequest & {
        user: User | JwtPayload;
    }, res: FastifyReply): Promise<void>;
    getProfile(req: FastifyRequest & {
        user: User;
    }): Promise<{
        user: User | (JwtPayload & User);
    }>;
    verifyToken(req: FastifyRequest & {
        user: User;
    }): Promise<{
        valid: boolean;
        user: {
            id: string;
            name: string;
            email: string;
            phoneNumber: string;
            role: UserRole;
            profilePicture: string | undefined;
            emailVerified: boolean;
            phoneVerified: boolean;
            googleId: any;
            hasPassword: boolean;
            onboardingCompleted: any;
            onboardingStatus: any;
        };
    }>;
    changePassword(body: {
        currentPassword: string;
        newPassword: string;
    }, req: FastifyRequest & {
        user: User | JwtPayload;
    }): Promise<{
        message: string;
    }>;
    enable2FA(req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
        secret?: string;
    }>;
    disable2FA(req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
    getSessions(req: FastifyRequest & {
        user: User;
    }): Promise<{
        sessions: {
            current: boolean;
            id: string;
            refreshToken: string;
            device: string;
            ipAddress: string;
            userAgent: string;
            location?: string;
            isActive: boolean;
            lastActive: Date;
            createdAt: Date;
            expiresAt: Date;
        }[];
    }>;
    terminateSession(sessionId: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
    terminateAllSessions(req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
    resendEmailVerification(req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
    resendPhoneVerification(req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
    deactivateAccount(req: FastifyRequest & {
        user: User | JwtPayload;
    }, res: FastifyReply): Promise<{
        message: string;
    }>;
    disconnectGoogle(req: FastifyRequest & {
        user: User | JwtPayload;
    }): Promise<{
        message: string;
    }>;
    getOnboardingStatus(req: FastifyRequest & {
        user: User | JwtPayload;
    }): Promise<{
        onboardingStatus: import("../users/schemas/user.schema").OnboardingStatus;
        role: UserRole;
        phoneNumber: string | null;
        name: string;
        email: string | null;
        profilePicture: string | null;
    }>;
    selectOnboardingRole(dto: SelectRoleDto, req: FastifyRequest & {
        user: User | JwtPayload;
    }): Promise<{
        onboardingStatus: import("../users/schemas/user.schema").OnboardingStatus;
        role: UserRole;
    }>;
    setOnboardingPhone(dto: SetPhoneDto, req: FastifyRequest & {
        user: User | JwtPayload;
    }): Promise<{
        onboardingStatus: import("../users/schemas/user.schema").OnboardingStatus;
        phoneNumber: string;
    }>;
    completeOnboarding(req: FastifyRequest & {
        user: User | JwtPayload;
    }, res: FastifyReply): Promise<AuthTokens>;
}
export {};
