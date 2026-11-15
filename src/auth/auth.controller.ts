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
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { FastifyRequest, FastifyReply } from 'fastify';

import { Throttle } from '@nestjs/throttler';
import { AuthService, AuthTokens, JwtPayload } from './auth.service';
import {
  RegisterEmailDto,
  RegisterPhoneDto,
  LoginEmailDto,
  LoginPhoneDto,
  SendPhoneCodeRequestDto,
  VerifyPhoneRequestDto,
  RefreshTokenDto,
  ChangePasswordDto,
  CheckEmailDto,
  OAuthExchangeDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { Public } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt.auth.guard';
import { User } from '../users/schemas/user.schema';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';
import { AllowIncompleteOnboarding } from './guards/onboarding.guard';
import { ForgotPasswordDto, ResetPasswordDto, ValidateResetTokenDto } from './dto/password-reset.dto';
import { SelectRoleDto, SetPhoneDto } from './dto/google-onboarding.dto';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User | JwtPayload;
  }
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

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
  async sendPhoneCode(@Body() dto: SendPhoneCodeRequestDto) {
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
    @Body() dto: RegisterPhoneDto,
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
    @Body() dto: RegisterEmailDto,
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
    @Body() dto: LoginPhoneDto,
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
    @Body() dto: LoginEmailDto,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<AuthTokens> {
    const tokens = await this.authService.loginWithEmail(dto, req);
    this.setAuthCookies(res, tokens);
    return tokens;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify phone number' })
  @ApiBody({ type: VerifyPhoneRequestDto })
  @ApiResponse({ status: 200, description: 'Phone verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid verification code' })
  async verifyPhone(@Body() dto: VerifyPhoneRequestDto) {
    return this.authService.verifyPhone(dto);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Body() body: RefreshTokenDto,
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
  @Throttle({ default: { limit: 10, ttl: 60000 } })
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

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('check-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Does an account exist for this email? (sign-up asks before the last step)' })
  async checkEmail(@Body() dto: CheckEmailDto) {
    return this.authService.checkEmail(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm an email address with the token from the verification email' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token);
  }

  @UseGuards(JwtAuthGuard)
  @AllowIncompleteOnboarding()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('google/link-intent')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start "Connect Google" for the signed-in account (one-time token, 10 min)' })
  async googleLinkIntent(@Req() req: FastifyRequest & { user: any }) {
    const u = req.user as any;
    return this.authService.createGoogleLinkIntent(String(u.userId ?? u._id ?? u.sub));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('google/exchange')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'App: swap the one-time Google sign-in code (+ PKCE verifier) for tokens' })
  async googleExchange(
    @Body() dto: OAuthExchangeDto,
    @Req() req: FastifyRequest,
  ): Promise<AuthTokens> {
    return this.authService.exchangeOAuthCode(dto.code, dto.codeVerifier, req);
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
    const state = String((req.query as any)?.state ?? '');
    // Only the app's own schemes and our web origins are accepted
    const target = this.authService.resolveOAuthRedirect(state);
    const withParams = (base: string, params: Record<string, string>) =>
      `${base}${base.includes('?') ? '&' : '?'}${new URLSearchParams(params).toString()}`;

    // A return link we don't allow: stop here with a readable page. Nothing is
    // issued, and we don't silently fall back to the website (that gave a 404).
    if (target.kind === 'rejected') {
      const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
      res.status(400).type('text/html; charset=utf-8').send(
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>HoroHouse</title></head><body style="font-family:system-ui,sans-serif;padding:32px;max-width:520px;margin:auto;color:#222">` +
        `<h2>Sign-in could not be completed</h2><p>La connexion n'a pas pu aboutir.</p>` +
        `<p style="color:#6a6a6a">${esc(target.reason || '')}</p>` +
        `<p>Close this page and go back to the app. / Fermez cette page et revenez à l'application.</p></body></html>`,
      );
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

      // "Connect Google" from Login & security: link, don't sign in
      if (target.kind === 'app' && target.linkToken) {
        try {
          await this.authService.linkGoogle(target.linkToken, dto);
          res.redirect(withParams(target.url, { linked: '1' }), 302);
        } catch (e: any) {
          const inUse = e?.response?.code === 'GOOGLE_IN_USE';
          this.logger.warn(`Google link failed: ${e?.message}`);
          res.redirect(withParams(target.url, { error: inUse ? 'google_in_use' : 'link_failed' }), 302);
        }
        return res;
      }

      if (target.kind === 'app') {
        // App: never put tokens in the URL. Hand over a one-time code that only
        // the app holding the matching PKCE verifier can exchange.
        if (!target.challenge) throw new BadRequestException('Missing sign-in challenge');
        const { user, isNewUser } = await this.authService.googleSignIn(dto);
        const code = await this.authService.issueOAuthCode(user, target.challenge, isNewUser);
        res.redirect(withParams(target.url, {
          code,
          ...(isNewUser ? { isNewUser: 'true' } : {}),
          ...(user.onboardingStatus ? { onboardingStatus: user.onboardingStatus } : {}),
        }), 302);
        return res;
      }

      // Web (same-site): httpOnly cookies carry the session.
      // TODO(web): the web app should stop reading tokens from this URL and rely
      // on the cookies; then drop `token`/`refresh` below.
      const authResult = await this.authService.googleAuth(dto, req);
      this.setAuthCookies(res, authResult);
      res.redirect(withParams(target.url, {
        token: authResult.accessToken,
        refresh: authResult.refreshToken,
        ...(authResult.isNewUser ? { isNewUser: 'true' } : {}),
        ...(authResult.onboardingStatus ? { onboardingStatus: authResult.onboardingStatus } : {}),
      }), 302);
      return res;
    } catch (error) {
      const msg = String((error as any)?.message || error);
      // This used to fail silently; log the real cause
      this.logger.error(`Google callback failed: ${msg}`, (error as any)?.stack);
      const reason = msg.includes('deactivated') ? 'account_deactivated' : 'oauth_failed';
      // In development, also tell the app why (never in production)
      const errorParams: Record<string, string> = { error: reason };
      if (process.env.NODE_ENV !== 'production') errorParams.detail = msg.slice(0, 200);
      const base = target.kind === 'app' && target.url
        ? target.url
        : `${(process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '')}/auth/login`;
      res.redirect(withParams(base, errorParams), 302);
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
    const u = req.user as any;
    const userId: string = u.userId || u._id?.toString() || u.sub;
    // This device only. If the token somehow has no session id, do nothing
    // rather than signing the person out everywhere.
    const sessionId: string | undefined = u.sessionId;
    if (sessionId) await this.authService.logout(userId, sessionId);
    this.clearAuthCookies(res);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
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
      throw new UnauthorizedException('Invalid token');
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
    @Body() body: ChangePasswordDto,
    @Req() req: FastifyRequest & { user: User | JwtPayload }
  ) {
    const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
    // Other devices are signed out; this one stays signed in
    return this.authService.changePassword(userId, body.currentPassword, body.newPassword, (req.user as any).sessionId);
  }

  @Post('enable-2fa')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable two-factor authentication' })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  async enable2FA(@Req() req: FastifyRequest & { user: User }) {
    return this.authService.enable2FA(req.user);
  }

  @Post('disable-2fa')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
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

  @Delete('sessions/all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Terminate all other sessions' })
  @ApiResponse({ status: 204, description: 'All other sessions terminated successfully' })
  async terminateAllSessions(@Req() req: FastifyRequest & { user: User }) {
    // The JWT carries the current session id (req.user.sessions isn't loaded,
    // so this used to end every session, including the current one)
    const currentSessionId = (req.user as any).sessionId;
    if (!currentSessionId) throw new BadRequestException('Current session unknown');
    return this.authService.terminateAllSessions(req.user, currentSessionId);
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

  @Post('resend-email-verification')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resend email verification' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  async resendEmailVerification(@Req() req: FastifyRequest & { user: User }) {
    return this.authService.resendEmailVerification(req.user);
  }

  @Post('resend-phone-verification')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
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
    // Rotate this device's session so the new tokens carry the chosen role
    const result = await this.authService.completeGoogleOnboarding(userId, req, (req.user as any).sessionId);
    this.setAuthCookies(res, result);
    return result;
  }
}