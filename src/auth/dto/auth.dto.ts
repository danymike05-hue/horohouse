// Request bodies for /auth/*. These are classes (not interfaces) so the global
// ValidationPipe actually checks them — with interfaces it lets anything through.
import {
  IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, Length, Matches, MaxLength, MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/schemas/user.schema';

/** bcrypt only uses the first 72 bytes of a password */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;

const E164 = /^\+[1-9]\d{6,14}$/;
const trimLower = ({ value }: { value: any }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: any }) => (typeof value === 'string' ? value.trim() : value);

export class RegisterEmailDto {
  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80)
  name: string;

  @ApiProperty() @Transform(trimLower) @IsEmail() @MaxLength(254)
  email: string;

  @ApiProperty() @IsString()
  @MinLength(PASSWORD_MIN, { message: `Password must be at least ${PASSWORD_MIN} characters` })
  @MaxLength(PASSWORD_MAX, { message: `Password must be at most ${PASSWORD_MAX} characters` })
  password: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  @Matches(E164, { message: 'Phone number must be in international format, e.g. +237612345678' })
  phoneNumber?: string;

  @ApiPropertyOptional({ enum: UserRole }) @IsOptional() @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional() @IsOptional() @IsObject()
  deviceInfo?: any;
}

export class RegisterPhoneDto {
  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80)
  name: string;

  @ApiProperty() @IsString() @Matches(E164, { message: 'Phone number must be in international format, e.g. +237612345678' })
  phoneNumber: string;

  @ApiPropertyOptional() @IsOptional() @Transform(trimLower) @IsEmail() @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ enum: UserRole }) @IsOptional() @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional() @IsOptional() @IsObject()
  deviceInfo?: any;
}

export class LoginEmailDto {
  @ApiProperty() @Transform(trimLower) @IsEmail() @MaxLength(254)
  email: string;

  // No minimum here: old accounts may have shorter passwords
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(256)
  password: string;

  @ApiPropertyOptional() @IsOptional() @IsObject()
  deviceInfo?: any;
}

export class SendPhoneCodeRequestDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(20)
  phoneNumber: string;
}

export class LoginPhoneDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(20)
  phoneNumber: string;

  @ApiProperty() @IsString() @Length(4, 8)
  verificationCode: string;

  @ApiPropertyOptional() @IsOptional() @IsObject()
  deviceInfo?: any;
}

export class VerifyPhoneRequestDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(20)
  phoneNumber: string;

  @ApiProperty() @IsString() @Length(4, 8)
  verificationCode: string;
}

export class RefreshTokenDto {
  // Optional: the web app sends it as an httpOnly cookie instead
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4096)
  refreshToken?: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(256)
  currentPassword: string;

  @ApiProperty() @IsString()
  @MinLength(PASSWORD_MIN, { message: `Password must be at least ${PASSWORD_MIN} characters` })
  @MaxLength(PASSWORD_MAX, { message: `Password must be at most ${PASSWORD_MAX} characters` })
  newPassword: string;
}

export class CheckEmailDto {
  @ApiProperty() @Transform(trimLower) @IsEmail() @MaxLength(254)
  email: string;
}

export class OAuthExchangeDto {
  /** One-time code from the horohouse://auth/callback?code=… redirect */
  @ApiProperty() @IsString() @Length(20, 128)
  code: string;

  /** PKCE verifier: the app's secret whose SHA-256 it put in the redirect as `cc` */
  @ApiProperty() @IsString() @Length(43, 128) @Matches(/^[A-Za-z0-9\-._~]+$/)
  codeVerifier: string;

  @ApiPropertyOptional() @IsOptional() @IsObject()
  deviceInfo?: any;
}

export class VerifyEmailDto {
  @ApiProperty() @IsString() @Length(16, 128)
  token: string;
}
