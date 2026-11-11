import { UserRole } from '../../users/schemas/user.schema';
export declare const PASSWORD_MIN = 8;
export declare const PASSWORD_MAX = 72;
export declare class RegisterEmailDto {
    name: string;
    email: string;
    password: string;
    phoneNumber?: string;
    role?: UserRole;
    deviceInfo?: any;
}
export declare class RegisterPhoneDto {
    name: string;
    phoneNumber: string;
    email?: string;
    role?: UserRole;
    deviceInfo?: any;
}
export declare class LoginEmailDto {
    email: string;
    password: string;
    deviceInfo?: any;
}
export declare class SendPhoneCodeRequestDto {
    phoneNumber: string;
}
export declare class LoginPhoneDto {
    phoneNumber: string;
    verificationCode: string;
    deviceInfo?: any;
}
export declare class VerifyPhoneRequestDto {
    phoneNumber: string;
    verificationCode: string;
}
export declare class RefreshTokenDto {
    refreshToken?: string;
}
export declare class ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
export declare class CheckEmailDto {
    email: string;
}
export declare class OAuthExchangeDto {
    code: string;
    codeVerifier: string;
    deviceInfo?: any;
}
export declare class VerifyEmailDto {
    token: string;
}
