import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail, IsEnum } from 'class-validator';
import { FastifyRequest, FastifyReply } from 'fastify';

import { Throttle } from '@nestjs/throttler';
import {
  AuthService,
  AuthTokens,
  RegisterWithPhoneDto,
  RegisterWithEmailDto,
  LoginWithPhoneDto,
  LoginWithEmailDto,
  SendPhoneCodeDto,
  VerifyPhoneDto,
  GoogleAuthDto,
  JwtPayload
} from './auth.service';
import { Public } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt.auth.guard';
import { User, UserRole } from '../users/schemas/user.schema';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { AllowIncompleteOnboarding } from './guards/onboarding.guard';
import { ForgotPasswordDto, ResetPasswordDto, ValidateResetTokenDto } from './dto/password-reset.dto';
import { SelectRoleDto, SetPhoneDto } from './dto/google-onboarding.dto';

// DTOs for API documentation
class SendPhoneCodeRequestDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}

class RegisterPhoneDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  deviceInfo?: any;
}

class RegisterEmailDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  deviceInfo?: any;
}

class LoginPhoneDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  verificationCode: string;

  @IsOptional()
  deviceInfo?: any;
}

class LoginEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  deviceInfo?: any;
}

class VerifyPhoneRequestDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  verificationCode: string;
}

class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: User | JwtPayload;
  }
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) { }

  private setAuthCookies(res: FastifyReply, tokens: AuthTokens) {
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

  private clearAuthCookies(res: FastifyReply) {
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('send-phone-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send phone verification code' })
  @ApiBody({ type: SendPhoneCodeRequestDto })
  @ApiResponse({ status: 200, description: 'Verification code sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid phone number' })
  async sendPhoneCode(@Body() dto: SendPhoneCodeDto) {
    return this.authService.sendPhoneVerificationCode(dto);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register/phone')
  @ApiOperation({ summary: 'Register with phone number' })
  @ApiBody({ type: RegisterPhoneDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async registerWithPhone(
    @Body() dto: RegisterWithPhoneDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthTokens> {
    const tokens = await this.authService.registerWithPhone(dto, req);
    this.setAuthCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('register/email')
  @ApiOperation({ summary: 'Register with email and password' })
  @ApiBody({ type: RegisterEmailDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async registerWithEmail(
    @Body() dto: RegisterWithEmailDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthTokens> {
    const tokens = await this.authService.registerWithEmail(dto, req);
    this.setAuthCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login/phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with phone verification code' })
  @ApiBody({ type: LoginPhoneDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async loginWithPhone(
    @Body() dto: LoginWithPhoneDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthTokens> {
    const tokens = await this.authService.loginWithPhone(dto, req);
    this.setAuthCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginEmailDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async loginWithEmail(
    @Body() dto: LoginWithEmailDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthTokens> {
    const tokens = await this.authService.loginWithEmail(dto, req);
    this.setAuthCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Post('verify-phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify phone number' })
  @ApiBody({ type: VerifyPhoneRequestDto })
  @ApiResponse({ status: 200, description: 'Phone verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid verification code' })
  async verifyPhone(@Body() dto: VerifyPhoneDto) {
    return this.authService.verifyPhone(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Body() body: Partial<RefreshTokenDto>,
    @Req() req: FastifyRequest & { cookies?: Record<string, string> },
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthTokens> {
    const token = body?.refreshToken || req.cookies?.refresh_token;
    if (!token) {
      throw new BadRequestException('Refresh token is required');
    }
    const tokens = await this.authService.refreshToken(token, req);
    this.setAuthCookies(res, tokens);
    return tokens;
  }


  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset email sent if account exists' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto.email);
  }

  @Public()
  @Post('validate-reset-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate password reset token' })
  @ApiBody({ type: ValidateResetTokenDto })
  @ApiResponse({ status: 200, description: 'Token validation result' })
  async validateResetToken(@Body() dto: ValidateResetTokenDto) {
    return this.authService.validateResetToken(dto.token);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // 🔥 FIX: Manually handle redirect for Fastify compatibility
  // Remove @Res() injection and let NestJS handle the response
  @Public()
  @Get('google')
  @UseGuards(GoogleOAuthGuard)  // Changed from AuthGuard('google')
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  async googleAuth() {
    // Guard handles the redirect to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthRedirect(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
    const googleUser = req.user as any;
    const state = (req.query as any)?.state;

    try {
      const authResult = await this.authService.googleAuth({
        googleId: googleUser.id,
        email: googleUser.email,
        name: googleUser.displayName,
        picture: googleUser.picture,
      }, req);

      this.setAuthCookies(res, authResult);

      let redirectUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

      // Build query params including onboarding status
      const params = new URLSearchParams({
        token: authResult.accessToken,
        refresh: authResult.refreshToken,
        ...(authResult.isNewUser ? { isNewUser: 'true' } : {}),
        ...(authResult.onboardingStatus ? { onboardingStatus: authResult.onboardingStatus } : {}),
      });

      // If state contains deep link (e.g., exp://... or horohouse://...), use it
      if (state && (state.startsWith('exp://') || state.startsWith('horohouse://') || state.startsWith('http'))) {
        const separator = state.includes('?') ? '&' : '?';
        redirectUrl = `${state}${separator}${params.toString()}`;
      } else {
        redirectUrl = `${redirectUrl}/auth/callback?${params.toString()}`;
      }

      // ✅ Fastify redirect signature: redirect(url, statusCode?)
      res.redirect(redirectUrl, 302);
      return res;
    } catch (error) {
      let errorUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      if (state && (state.startsWith('exp://') || state.startsWith('horohouse://') || state.startsWith('http'))) {
        const separator = state.includes('?') ? '&' : '?';
        errorUrl = `${state}${separator}error=oauth_failed`;
      } else {
        errorUrl = `${errorUrl}/auth/login?error=oauth_failed`;
      }

      res.redirect(errorUrl, 302);
      return res;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 204, description: 'Logout successful' })
  async logout(
    @Req() req: FastifyRequest & { user: User | JwtPayload },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    let userId: string;
    let sessionId: string | undefined;

    if ('_id' in req.user) {
      userId = req.user._id.toString();
    } else {
      userId = req.user.sub;
      sessionId = req.user.sessionId;
    }

    await this.authService.logout(userId, sessionId);
    this.clearAuthCookies(res);
  }

  @Get('profile')
  @AllowIncompleteOnboarding()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Req() req: FastifyRequest & { user: User }) {
    return {
      user: req.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @AllowIncompleteOnboarding()
  @Get('verify-token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify if current token is valid' })
  async verifyToken(@Req() req: FastifyRequest & { user: User }) {
    try {
      if (!req.user) {
        throw new Error('User not found in request');
      }

      let userId: string;

      if (req.user._id) {
        userId = req.user._id.toString();
      } else if ((req.user as any).id) {
        userId = (req.user as any).id;
      } else if ((req.user as any).sub) {
        userId = (req.user as any).sub;
      } else {
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
          googleId: (req.user as any).googleId,
          hasPassword: !!(req.user as any).hasPassword,
          onboardingCompleted: (req.user as any).onboardingCompleted ?? false,
          onboardingStatus: (req.user as any).onboardingStatus || 'completed',
        },
      };
    } catch (error) {
      console.error('Error in verifyToken:', error);
      throw new Error('Failed to verify token');
    }
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current password' })
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @Req() req: FastifyRequest & { user: User | JwtPayload }
  ) {
    const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
    return this.authService.changePassword(userId, body.currentPassword, body.newPassword);
  }

  @Post('enable-2fa')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable two-factor authentication' })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  async enable2FA(@Req() req: FastifyRequest & { user: User }) {
    return this.authService.enable2FA(req.user);
  }

  @Post('disable-2fa')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable two-factor authentication' })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  async disable2FA(@Req() req: FastifyRequest & { user: User }) {
    return this.authService.disable2FA(req.user);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user active sessions' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  async getSessions(@Req() req: FastifyRequest & { user: User }) {
    const sessions = await this.authService.getUserSessions(req.user);

    const currentSessionId = (req.user as any).sessionId;
    const sessionsWithCurrent = sessions.map(session => ({
      ...session,
      current: session.id === currentSessionId
    }));

    return { sessions: sessionsWithCurrent };
  }

  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Terminate a specific session' })
  @ApiResponse({ status: 204, description: 'Session terminated successfully' })
  async terminateSession(
    @Param('sessionId') sessionId: string,
    @Req() req: FastifyRequest & { user: User }
  ) {
    return this.authService.terminateSession(req.user, sessionId);
  }

  @Delete('sessions/all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Terminate all other sessions' })
  @ApiResponse({ status: 204, description: 'All other sessions terminated successfully' })
  async terminateAllSessions(@Req() req: FastifyRequest & { user: User }) {
    const currentSessionId = req.user.sessions?.[0]?.id;
    return this.authService.terminateAllSessions(req.user, currentSessionId);
  }

  @Post('resend-email-verification')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resend email verification' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  async resendEmailVerification(@Req() req: FastifyRequest & { user: User }) {
    return this.authService.resendEmailVerification(req.user);
  }

  @Post('resend-phone-verification')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend phone verification' })
  @ApiResponse({ status: 200, description: 'Verification SMS sent' })
  async resendPhoneVerification(@Req() req: FastifyRequest & { user: User }) {
    return this.authService.resendPhoneVerification(req.user);
  }

  @Post('deactivate-account')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Self-service account deactivation — sets isActive=false and invalidates all sessions' })
  @ApiResponse({ status: 200, description: 'Account deactivated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deactivateAccount(
    @Req() req: FastifyRequest & { user: User | JwtPayload },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
    const result = await this.authService.deactivateAccount(userId);
    this.clearAuthCookies(res);
    return result;
  }

  @Post('disconnect/google')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disconnect Google social login from the account (requires password to be set)' })
  @ApiResponse({ status: 200, description: 'Google account disconnected successfully' })
  @ApiResponse({ status: 400, description: 'Cannot disconnect — user has no password set' })
  async disconnectGoogle(
    @Req() req: FastifyRequest & { user: User | JwtPayload },
  ) {
    const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
    return this.authService.disconnectGoogle(userId);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Google Onboarding Endpoints
  // ══════════════════════════════════════════════════════════════════════════

  @Get('onboarding/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowIncompleteOnboarding()
  @ApiOperation({ summary: 'Get Google onboarding status for the current user' })
  @ApiResponse({ status: 200, description: 'Onboarding status retrieved successfully' })
  async getOnboardingStatus(@Req() req: FastifyRequest & { user: User | JwtPayload }) {
    const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
    return this.authService.getGoogleOnboardingStatus(userId);
  }

  @Post('onboarding/select-role')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowIncompleteOnboarding()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 1: Select role during Google onboarding' })
  @ApiBody({ type: SelectRoleDto })
  @ApiResponse({ status: 200, description: 'Role selected successfully' })
  @ApiResponse({ status: 400, description: 'Invalid role or onboarding already completed' })
  async selectOnboardingRole(
    @Body() dto: SelectRoleDto,
    @Req() req: FastifyRequest & { user: User | JwtPayload },
  ) {
    const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
    return this.authService.selectOnboardingRole(userId, dto.role);
  }

  @Post('onboarding/set-phone')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowIncompleteOnboarding()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 2: Set phone number during Google onboarding' })
  @ApiBody({ type: SetPhoneDto })
  @ApiResponse({ status: 200, description: 'Phone number set successfully' })
  @ApiResponse({ status: 400, description: 'Invalid phone number or wrong onboarding step' })
  @ApiResponse({ status: 409, description: 'Phone number already registered' })
  async setOnboardingPhone(
    @Body() dto: SetPhoneDto,
    @Req() req: FastifyRequest & { user: User | JwtPayload },
  ) {
    const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
    return this.authService.setOnboardingPhone(userId, dto.phoneNumber);
  }

  @Post('onboarding/complete')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @AllowIncompleteOnboarding()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Step 3: Complete Google onboarding' })
  @ApiResponse({ status: 200, description: 'Onboarding completed successfully' })
  @ApiResponse({ status: 400, description: 'Missing required fields or already completed' })
  async completeOnboarding(
    @Req() req: FastifyRequest & { user: User | JwtPayload },
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
    const result = await this.authService.completeGoogleOnboarding(userId);
    this.setAuthCookies(res, result);
    return result;
  }
}