import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtSignOptions, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { SmsService } from './sms.service';
import { EmailService } from '../email/email.service';
import { User, UserDocument, UserRole, UserSession, OnboardingStatus } from '../users/schemas/user.schema';

export interface JwtPayload {
  sub: string;
  phoneNumber: string;
  email?: string;
  role: UserRole;
  sessionId: string; // Add sessionId to JWT payload
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

// ── DTOs ──────────────────────────────────────────────────────────────────
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  
  private static readonly SELF_ASSIGNABLE_ROLES: UserRole[] = [
    UserRole.REGISTERED_USER,
    UserRole.AGENT,
    UserRole.LANDLORD,
    UserRole.HOST,
    UserRole.STUDENT,
  ];

  private resolveSelfAssignableRole(requested?: UserRole): UserRole {
    if (requested && AuthService.SELF_ASSIGNABLE_ROLES.includes(requested)) {
      return requested;
    }
    return UserRole.REGISTERED_USER;
  }

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private smsService: SmsService,
    private emailService: EmailService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) { }


  /**
   * Send phone verification code
   */
  async sendPhoneVerificationCode(dto: SendPhoneCodeDto): Promise<{ message: string }> {
    try {
      const { phoneNumber } = dto;

      if (!this.smsService.isValidPhoneNumber(phoneNumber)) {
        throw new BadRequestException('Invalid phone number format');
      }

      const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);

      // Per-phone-number cooldown — independent of IP-based throttling,
      // so rotating IPs can't be used to spam a single victim's phone.
      const existing = await this.userModel
        .findOne({ phoneNumber: formattedPhone })
        .select('phoneVerificationSentAt')
        .lean();

      const COOLDOWN_MS = 60 * 1000; // 1 code per phone number per 60s
      if (
        existing &&
        (existing as any).phoneVerificationSentAt &&
        Date.now() - new Date((existing as any).phoneVerificationSentAt).getTime() < COOLDOWN_MS
      ) {
        throw new BadRequestException(
          'A verification code was already sent recently. Please wait before requesting another.',
        );
      }

      const verificationCode = this.smsService.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store verification code in database
      await this.userModel.updateOne(
        { phoneNumber: formattedPhone },
        {
          phoneVerificationCode: verificationCode,
          phoneVerificationExpires: expiresAt,
          phoneVerificationSentAt: new Date(),
        },
        { upsert: true, setDefaultsOnInsert: true }
      );

      // Send SMS
      const smsSent = await this.smsService.sendVerificationCode(formattedPhone, verificationCode);

      if (!smsSent) {
        throw new BadRequestException('Failed to send verification code');
      }

      this.logger.log(`Verification code sent to ${formattedPhone}`);

      return { message: 'Verification code sent successfully' };
    } catch (error) {
      this.logger.error('Failed to send phone verification code:', error);
      throw error;
    }
  }

  /**
   * Register with phone number
   */
async registerWithPhone(dto: RegisterWithPhoneDto, req?: any): Promise<AuthTokens> {
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
      throw new ConflictException('User already exists with this phone number or email');
    }

    const user = await this.userModel.create({
      name,
      phoneNumber: formattedPhone,
      email,
      role: this.resolveSelfAssignableRole(role),
      phoneVerified: false,
      emailVerified: false,
      onboardingCompleted: true,
      onboardingStatus: OnboardingStatus.COMPLETED,
    });

      this.logger.log(`New user registered with phone: ${formattedPhone}`);

      // Send both welcome email and verification email if email is present
      if (user.email) {
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await this.userModel.findByIdAndUpdate(user._id, {
          emailVerificationToken: verificationToken,
          emailVerificationExpires: expiresAt
        });

        // Send welcome email
        void this.emailService.sendWelcomeEmail(user.email, user.name).catch(() => undefined);

        // Send verification email
        void this.emailService.sendEmailVerification(user.email, user.name, verificationToken).catch(() => undefined);
      }

      const tokens = await this.generateTokens(user, req);

      return {
        ...tokens,
        user: user.toJSON(),
      };
    } catch (error) {
      this.logger.error('Phone registration failed:', error);
      throw error;
    }
  }

  /**
   * Register with email and password
   */
async registerWithEmail(dto: RegisterWithEmailDto, req?: any): Promise<AuthTokens> {
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
      throw new ConflictException('User already exists with this email or phone number');
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
      onboardingStatus: OnboardingStatus.COMPLETED,
    });

      this.logger.log(`New user registered with email: ${normalizedEmail}`);

      // Send both welcome email and verification email
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await this.userModel.findByIdAndUpdate(user._id, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expiresAt
      });

      // Send welcome email
      void this.emailService.sendWelcomeEmail(user.email!, user.name).catch(() => undefined);

      // Send verification email
      void this.emailService.sendEmailVerification(user.email!, user.name, verificationToken).catch(() => undefined);

      const tokens = await this.generateTokens(user, req);

      return {
        ...tokens,
        user: user.toJSON(),
      };
    } catch (error) {
      this.logger.error('Email registration failed:', error);
      throw error;
    }
  }

  /**
   * Login with phone verification
   */
  async loginWithPhone(dto: LoginWithPhoneDto, req?: any): Promise<AuthTokens> {
    try {
      const { phoneNumber, verificationCode } = dto;

      const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);

      // Find user and verify code
      const user = await this.userModel.findOne({ phoneNumber: formattedPhone });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.phoneVerificationCode || !user.phoneVerificationExpires) {
        throw new UnauthorizedException('No verification code found. Please request a new one.');
      }

      if (user.phoneVerificationExpires < new Date()) {
        throw new UnauthorizedException('Verification code has expired');
      }

      if (user.phoneVerificationCode !== verificationCode) {
        throw new UnauthorizedException('Invalid verification code');
      }

      // Mark phone as verified and clear verification code
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
    } catch (error) {
      this.logger.error('Phone login failed:', error);
      throw error;
    }
  }

  /**
   * Login with email and password
   */
  async loginWithEmail(dto: LoginWithEmailDto, req?: any): Promise<AuthTokens> {
    try {
      const { email, password } = dto;
      const normalizedEmail = email.trim().toLowerCase();

      // Case-insensitive lookup
      const user = await this.userModel.findOne({
        email: { $regex: `^${normalizedEmail}$`, $options: 'i' }
      });

      if (!user) {
        this.logger.error(`Email login failed: user not found for email ${normalizedEmail}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.password) {
        this.logger.error(`Email login failed: no password set for email ${normalizedEmail}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        this.logger.error(`Email login failed: wrong password for email ${normalizedEmail}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      this.logger.log(`User logged in with email: ${normalizedEmail}`);

      const tokens = await this.generateTokens(user, req);

      return {
        ...tokens,
        user: user.toJSON(),
      };
    } catch (error) {
      this.logger.error('Email login failed:', error);
      throw error;
    }
  }

  /**
   * Google OAuth authentication
   */
  async googleAuth(dto: GoogleAuthDto, req?: any): Promise<AuthTokens> {
    try {
      const { googleId, email, name, picture } = dto;

      // Find existing user by googleId first, then by email
      let user = await this.userModel.findOne({
        $or: [{ googleId }, { email }]
      });

      let isNewUser = false;

      if (!user) {
        // Create new user — onboarding is NOT_STARTED
        isNewUser = true;
        user = await this.userModel.create({
          googleId,
          name,
          email,
          profilePicture: picture,
          phoneNumber: `google_${Date.now()}`, // Temporary placeholder
          role: UserRole.REGISTERED_USER,       // Temporary — will be replaced during onboarding
          emailVerified: true,
          phoneVerified: false,
          onboardingCompleted: false,
          onboardingStatus: OnboardingStatus.NOT_STARTED,
        });

        this.logger.log(`New user created via Google OAuth: ${email}`);

        // Send welcome email
        if (user.email) {
          void this.emailService.sendWelcomeEmail(user.email, user.name).catch(() => undefined);
        }
      } else {
        // Existing user — link Google if not already linked, but NEVER overwrite role/phone
        if (!user.googleId) user.googleId = googleId;
        if (!user.profilePicture && picture) user.profilePicture = picture;
        user.emailVerified = true;

        // Check if existing user has incomplete onboarding.
        // IMPORTANT: only flag onboarding-required if the user has NOT already completed it.
        // Never downgrade a COMPLETED onboarding status.
        const hasPlaceholderPhone =
          !user.phoneNumber ||
          user.phoneNumber.startsWith('google_') ||
          user.phoneNumber.startsWith('temp_');

        // Explicit completion flag
        const explicitlyCompleted =
          user.onboardingStatus === OnboardingStatus.COMPLETED ||
          user.onboardingCompleted === true;

        // Implicit completion: users registered via email/phone before
        // onboarding fields existed — they have a real phone + valid role
        const implicitlyCompleted =
          !hasPlaceholderPhone &&
          user.role !== UserRole.REGISTERED_USER &&
          AuthService.ONBOARDING_SELF_ASSIGNABLE_ROLES.includes(user.role);

        const alreadyCompleted = explicitlyCompleted || implicitlyCompleted;

        if (alreadyCompleted) {
          // Back-fill missing onboarding fields for legacy users
          if (user.onboardingStatus !== OnboardingStatus.COMPLETED) {
            user.onboardingStatus = OnboardingStatus.COMPLETED;
            user.onboardingCompleted = true;
          }
        } else {
          if (!user.onboardingStatus) {
            user.onboardingStatus = OnboardingStatus.NOT_STARTED;
          }
          user.onboardingCompleted = false;
          isNewUser = true; // Signal to clients that onboarding is required
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
    } catch (error) {
      this.logger.error('Google OAuth failed:', error);
      throw error;
    }
  }

  /**
   * Verify phone number
   */
  async verifyPhone(dto: VerifyPhoneDto): Promise<{ message: string }> {
    try {
      const { phoneNumber, verificationCode } = dto;

      const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);

      const user = await this.userModel.findOne({ phoneNumber: formattedPhone });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.phoneVerificationCode || !user.phoneVerificationExpires) {
        throw new UnauthorizedException('No verification code found');
      }

      if (user.phoneVerificationExpires < new Date()) {
        throw new UnauthorizedException('Verification code has expired');
      }

      if (user.phoneVerificationCode !== verificationCode) {
        throw new UnauthorizedException('Invalid verification code');
      }

      // Mark phone as verified
      user.phoneVerified = true;
      user.phoneVerificationCode = undefined;
      user.phoneVerificationExpires = undefined;
      await user.save();

      return { message: 'Phone number verified successfully' };
    } catch (error) {
      this.logger.error('Phone verification failed:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string, req?: any): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      }) as JwtPayload;

      const user = await this.userModel.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Find the session with this refresh token
      // Prefer locating the session by sessionId embedded in the token if available.
      let session = undefined as any;
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
        throw new UnauthorizedException('Invalid refresh token - session not found');
      }

      // Check if session has expired
      if (session.expiresAt < new Date()) {
        // Remove expired session
        user.sessions = user.sessions.filter(s => s.id !== session.id);
        await user.save();
        throw new UnauthorizedException('Session expired');
      }

      // Update session activity
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
    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Validate user from JWT payload
   */
  async validateUser(payload: JwtPayload): Promise<UserDocument> {
    const user = await this.userModel.findById(payload.sub).select('+password');
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Check if session is still valid
    const session = user.sessions.find(s => s.id === payload.sessionId && s.isActive);
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session invalid or expired');
    }

    return user;
  }

  /**
   * Logout user - terminate current session
   */
  async logout(userId: string, sessionId?: string): Promise<void> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (sessionId) {
        // Remove specific session
        user.sessions = user.sessions.filter(s => s.id !== sessionId);
      } else {
        // Remove all sessions if no specific sessionId
        user.sessions = [];
      }

      await user.save();

      this.logger.log(`User logged out: ${userId}${sessionId ? ` (session: ${sessionId})` : ' (all sessions)'}`);
    } catch (error) {
      this.logger.error('Logout failed:', error);
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    // Find user including password explicitly
    const user = await this.userModel.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException('User does not have a password set');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password and invalidate all sessions except current one (optional)
    user.password = hashedNewPassword;
    await user.save();

    this.logger.log(`Password changed for user: ${user._id}`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Enable two-factor authentication
   */
  async enable2FA(user: User): Promise<{ message: string; secret?: string }> {
    try {
      // For now, we'll just mark 2FA as enabled
      // In a real implementation, you'd generate a TOTP secret
      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      await this.userModel.findByIdAndUpdate(userId, {
        twoFactorEnabled: true
      });

      this.logger.log(`2FA enabled for user: ${userId}`);

      return { message: 'Two-factor authentication enabled successfully' };
    } catch (error) {
      this.logger.error('2FA enable failed:', error);
      throw error;
    }
  }

  /**
   * Disable two-factor authentication
   */
  async disable2FA(user: User): Promise<{ message: string }> {
    try {
      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      await this.userModel.findByIdAndUpdate(userId, {
        twoFactorEnabled: false,
        twoFactorSecret: undefined
      });

      this.logger.log(`2FA disabled for user: ${userId}`);

      return { message: 'Two-factor authentication disabled successfully' };
    } catch (error) {
      this.logger.error('2FA disable failed:', error);
      throw error;
    }
  }

  /**
   * Get user active sessions
   */
  async getUserSessions(user: User): Promise<UserSession[]> {
    try {
      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      const userDoc = await this.userModel.findById(userId);

      if (!userDoc) {
        throw new NotFoundException('User not found');
      }

      // Remove expired sessions and return active ones
      const now = new Date();
      const activeSessions = userDoc.sessions.filter(session =>
        session.isActive && session.expiresAt > now
      );

      // Update user document if we found expired sessions
      if (activeSessions.length !== userDoc.sessions.length) {
        userDoc.sessions = activeSessions;
        await userDoc.save();
      }

      const plainSessions = userDoc.toObject().sessions;

      return plainSessions.map((session: any) => ({
        ...session,
        refreshToken: undefined,
      })) as UserSession[];
    } catch (error) {
      this.logger.error('Get sessions failed:', error);
      throw error;
    }
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(user: User, sessionId: string): Promise<{ message: string }> {
    try {
      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      const userDoc = await this.userModel.findById(userId);

      if (!userDoc) {
        throw new NotFoundException('User not found');
      }

      // Remove the specific session
      const originalSessionCount = userDoc.sessions.length;
      userDoc.sessions = userDoc.sessions.filter(s => s.id !== sessionId);

      if (userDoc.sessions.length === originalSessionCount) {
        throw new NotFoundException('Session not found');
      }

      await userDoc.save();

      this.logger.log(`Session ${sessionId} terminated for user: ${userId}`);

      return { message: 'Session terminated successfully' };
    } catch (error) {
      this.logger.error('Session termination failed:', error);
      throw error;
    }
  }

  /**
   * Terminate all other sessions
   */
  async terminateAllSessions(user: User, currentSessionId?: string): Promise<{ message: string }> {
    try {
      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      const userDoc = await this.userModel.findById(userId);

      if (!userDoc) {
        throw new NotFoundException('User not found');
      }

      if (currentSessionId) {
        // Keep only the current session
        userDoc.sessions = userDoc.sessions.filter(s => s.id === currentSessionId);
      } else {
        // Remove all sessions
        userDoc.sessions = [];
      }

      await userDoc.save();

      this.logger.log(`All other sessions terminated for user: ${userId}`);

      return { message: 'All other sessions terminated successfully' };
    } catch (error) {
      this.logger.error('All sessions termination failed:', error);
      throw error;
    }
  }

  /**
   * Resend email verification
   */
  async resendEmailVerification(user: User): Promise<{ message: string }> {
    try {
      if (!user.email) {
        throw new BadRequestException('User does not have an email address');
      }

      if (user.emailVerified) {
        throw new BadRequestException('Email is already verified');
      }

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      await this.userModel.findByIdAndUpdate(userId, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expiresAt
      });

      // In a real implementation, you'd send an email here
      this.logger.log(`Email verification resent to: ${user.email}`);

      return { message: 'Verification email sent successfully' };
    } catch (error) {
      this.logger.error('Email verification resend failed:', error);
      throw error;
    }
  }

  /**
   * Resend phone verification
   */
  async resendPhoneVerification(user: User): Promise<{ message: string }> {
    try {
      if (user.phoneVerified) {
        throw new BadRequestException('Phone number is already verified');
      }

      // Generate new verification code
      const verificationCode = this.smsService.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      await this.userModel.findByIdAndUpdate(userId, {
        phoneVerificationCode: verificationCode,
        phoneVerificationExpires: expiresAt
      });

      // Send SMS
      const smsSent = await this.smsService.sendVerificationCode(user.phoneNumber, verificationCode);

      if (!smsSent) {
        throw new BadRequestException('Failed to send verification code');
      }

      this.logger.log(`Phone verification resent to: ${user.phoneNumber}`);

      return { message: 'Verification code sent successfully' };
    } catch (error) {
      this.logger.error('Phone verification resend failed:', error);
      throw error;
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    try {
      const user = await this.userModel.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new UnauthorizedException('Invalid or expired verification token');
      }

      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      this.logger.log(`Email verified for user: ${user._id}`);

      return { message: 'Email verified successfully' };
    } catch (error) {
      this.logger.error('Email verification failed:', error);
      throw error;
    }
  }

  /**
   * Request password reset - Send reset email
   */
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    try {
      const normalizedEmail = email.trim().toLowerCase();

      // Find user by email (case-insensitive)
      const user = await this.userModel.findOne({
        email: { $regex: `^${normalizedEmail}$`, $options: 'i' }
      });

      // Always return success message (don't reveal if email exists)
      if (!user) {
        this.logger.log(`Password reset requested for non-existent email: ${normalizedEmail}`);
        return { message: 'If an account exists with this email, you will receive a password reset link shortly.' };
      }

      // Check if user has a password (not OAuth-only user)
      if (!user.password) {
        this.logger.log(`Password reset requested for OAuth-only user: ${normalizedEmail}`);
        return { message: 'If an account exists with this email, you will receive a password reset link shortly.' };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Save hashed token to database
      user.resetPasswordToken = hashedToken;
      user.resetPasswordExpires = expiresAt;
      await user.save();

      this.logger.log(`Password reset token generated for user: ${user._id}`);

      // Send reset email
      try {
        await this.emailService.sendPasswordResetEmail(
          user.email!,
          user.name,
          resetToken // Send unhashed token in email
        );
      } catch (error) {
        this.logger.error('Failed to send password reset email:', error);
        // Don't throw error to user - just log it
      }

      return { message: 'If an account exists with this email, you will receive a password reset link shortly.' };
    } catch (error) {
      this.logger.error('Password reset request failed:', error);
      throw new BadRequestException('Failed to process password reset request');
    }
  }

  /**
   * Validate reset token
   */
  async validateResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
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
    } catch (error) {
      this.logger.error('Token validation failed:', error);
      return { valid: false };
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    try {
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Find user with valid reset token
      const user = await this.userModel.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() }
      });

      if (!user) {
        throw new UnauthorizedException('Invalid or expired password reset token');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password and clear reset token
      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;

      // Invalidate all existing sessions for security
      user.sessions = [];

      await user.save();

      this.logger.log(`Password reset successfully for user: ${user._id}`);

      // Send confirmation email
      try {
        await this.emailService.sendPasswordResetConfirmation(
          user.email!,
          user.name
        );
      } catch (error) {
        this.logger.error('Failed to send password reset confirmation:', error);
        // Don't throw error - password was already reset
      }

      return { message: 'Password has been reset successfully. You can now sign in with your new password.' };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error('Password reset failed:', error);
      throw new BadRequestException('Failed to reset password');
    }
  }

  /**
   * Generate JWT tokens and create session
   */
  private async generateTokens(user: UserDocument, req?: any, existingSessionId?: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // Generate session ID
    const sessionId = existingSessionId || crypto.randomUUID();

    const payload: JwtPayload = {
      sub: user._id.toString(),
      phoneNumber: user.phoneNumber,
      email: user.email,
      role: user.role,
      sessionId,
      onboardingStatus: user.onboardingStatus,
      onboardingCompleted: user.onboardingCompleted ?? (user.onboardingStatus === OnboardingStatus.COMPLETED),
    };

    const accessTokenOptions: JwtSignOptions = {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.parseTokenExpiration(this.configService.get<string>('JWT_EXPIRATION', '1h')),
    };

    const refreshTokenOptions: JwtSignOptions = {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.parseTokenExpiration(this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d')),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, accessTokenOptions),
      this.jwtService.signAsync(payload, refreshTokenOptions),
    ]);

    // Create or update session
    if (!existingSessionId) {
      const refreshTokenExpirationTime = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d');
      const expirationMs = this.parseTokenExpiration(refreshTokenExpirationTime);
      const expiresAt = new Date(Date.now() + expirationMs);

      const deviceInfo = req?.body?.deviceInfo || {};
      const userAgent = req?.headers?.['user-agent'] || 'Unknown';
      const ipAddress = this.getClientIp(req);

      const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

      const newSession: UserSession = {
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

      // Add new session to user
      user.sessions.push(newSession);

      // Clean up expired sessions while we're at it
      const now = new Date();
      user.sessions = user.sessions.filter(session => session.expiresAt > now);

      // Limit number of active sessions (optional - keep last 10)
      if (user.sessions.length > 10) {
        user.sessions = user.sessions
          .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime())
          .slice(0, 10);
      }

      await user.save();
    } else {
      // Update existing session with new refresh token
      const sessionIndex = user.sessions.findIndex(s => s.id === existingSessionId);
      if (sessionIndex !== -1) {
        user.sessions[sessionIndex].refreshToken = refreshToken;
        user.sessions[sessionIndex].lastActive = new Date();
        await user.save();
      }
    }

    return { accessToken, refreshToken };
  }

  /**
   * Helper method to extract client IP
   */
  private getClientIp(req?: any): string {
    if (!req) return 'Unknown';

    return req.ip ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      (req.headers && (
        req.headers['x-forwarded-for']?.split(',')[0] ||
        req.headers['x-real-ip'] ||
        req.headers['x-client-ip']
      )) ||
      'Unknown';
  }

  /**
   * Helper method to parse device information
   */
  private parseDeviceInfo(userAgent: string, deviceInfo?: any): string {
    if (deviceInfo?.device) {
      return deviceInfo.device;
    }

    // Simple user agent parsing
    const ua = userAgent.toLowerCase();

    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // Detect browser
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';

    // Detect OS
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('macintosh') || ua.includes('mac os x')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

    return `${browser} on ${os}`;
  }

  /**
   * Helper method to get location from IP (mock implementation)
   */
  private async getLocationFromIp(ipAddress: string): Promise<string> {
    // In a real implementation, you would use a service like:
    // - MaxMind GeoIP
    // - IPInfo.io
    // - ip-api.com
    // For now, return a mock location

    if (ipAddress === 'Unknown' || ipAddress.startsWith('127.') || ipAddress.startsWith('192.168.')) {
      return 'Local Network';
    }

    // Mock location - in production, integrate with a real geolocation service
    return 'Unknown Location';
  }

  /**
   * Helper method to parse token expiration string to milliseconds
   */
  private parseTokenExpiration(expiration: string): number {
    const regex = /^(\d+)([smhd])$/;
    const match = expiration.match(regex);

    if (!match) {
      return 7 * 24 * 60 * 60 * 1000; // Default 7 days
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

  /**
   * Clean up expired sessions (call this periodically)
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = new Date();
      await this.userModel.updateMany(
        { 'sessions.expiresAt': { $lt: now } },
        { $pull: { sessions: { expiresAt: { $lt: now } } } }
      );

      this.logger.log('Expired sessions cleaned up');
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions:', error);
    }
  }

  /**
   * Self-service account deactivation.
   * Sets isActive=false and wipes all sessions so existing tokens stop working.
   */
  async deactivateAccount(userId: string): Promise<{ message: string }> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      user.isActive = false;
      user.sessions = [];
      await user.save();

      this.logger.log(`Account deactivated by user: ${userId}`);

      return { message: 'Account deactivated successfully' };
    } catch (error) {
      this.logger.error('Account deactivation failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect a social provider (e.g. Google) from the user's account.
   * Only allowed when the user has a password set, to prevent lock-out.
   */
  async disconnectGoogle(userId: string): Promise<{ message: string }> {
    try {
      const user = await this.userModel.findById(userId).select('+password');
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (!user.password) {
        throw new BadRequestException(
          'You must set a password before disconnecting Google to avoid losing account access.',
        );
      }

      await this.userModel.findByIdAndUpdate(userId, {
        $unset: { googleId: '' },
      });

      this.logger.log(`Google disconnected for user: ${userId}`);

      return { message: 'Google account disconnected successfully' };
    } catch (error) {
      this.logger.error('Google disconnect failed:', error);
      throw error;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Google Onboarding — 3-step flow: role → phone → complete
  // ══════════════════════════════════════════════════════════════════════════

  private static readonly ONBOARDING_SELF_ASSIGNABLE_ROLES: UserRole[] = [
    UserRole.REGISTERED_USER,
    UserRole.HOST,
    UserRole.LANDLORD,
    UserRole.AGENT,
  ];

  /**
   * Get onboarding status for the current user.
   */
  async getGoogleOnboardingStatus(userId: string): Promise<{
    onboardingStatus: OnboardingStatus;
    role: UserRole;
    phoneNumber: string | null;
    name: string;
    email: string | null;
    profilePicture: string | null;
  }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
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

  /**
   * Step 1: Select role during Google onboarding.
   */
  async selectOnboardingRole(userId: string, role: UserRole): Promise<{ onboardingStatus: OnboardingStatus; role: UserRole }> {
    if (!AuthService.ONBOARDING_SELF_ASSIGNABLE_ROLES.includes(role)) {
      throw new BadRequestException(
        `Invalid role. Allowed roles: ${AuthService.ONBOARDING_SELF_ASSIGNABLE_ROLES.join(', ')}`,
      );
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only allow role selection if onboarding is not yet completed
    if (user.onboardingStatus === OnboardingStatus.COMPLETED) {
      throw new BadRequestException('Onboarding is already completed. Role cannot be changed here.');
    }

    user.role = role;
    user.onboardingStatus = OnboardingStatus.ROLE_SELECTED;
    await user.save();

    this.logger.log(`Onboarding role selected for user ${userId}: ${role}`);

    return {
      onboardingStatus: user.onboardingStatus,
      role: user.role,
    };
  }

  /**
   * Step 2: Set phone number during Google onboarding.
   */
  async setOnboardingPhone(userId: string, phoneNumber: string): Promise<{ onboardingStatus: OnboardingStatus; phoneNumber: string }> {
    // Validate E.164 format
    if (!this.smsService.isValidPhoneNumber(phoneNumber)) {
      throw new BadRequestException('Invalid phone number format. Use E.164 format (e.g. +237612345678).');
    }

    const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Only allow phone setting if onboarding is not completed
    if (user.onboardingStatus === OnboardingStatus.COMPLETED) {
      throw new BadRequestException('Onboarding is already completed.');
    }

    // Must have selected a role first
    if (user.onboardingStatus === OnboardingStatus.NOT_STARTED) {
      throw new BadRequestException('Please select a role before providing a phone number.');
    }

    // Check for duplicate phone numbers (excluding temp placeholders and the user themselves)
    const existingUser = await this.userModel.findOne({
      _id: { $ne: user._id },
      phoneNumber: formattedPhone,
    });

    if (existingUser) {
      throw new ConflictException('This phone number is already registered to another account.');
    }

    user.phoneNumber = formattedPhone;
    user.phoneVerified = false; // Explicitly unverified — no OTP at this stage
    user.onboardingStatus = OnboardingStatus.PHONE_PROVIDED;
    await user.save();

    this.logger.log(`Onboarding phone set for user ${userId}: ${formattedPhone}`);

    return {
      onboardingStatus: user.onboardingStatus,
      phoneNumber: formattedPhone,
    };
  }

  /**
   * Step 3: Complete onboarding.
   * Validates that role and phone are properly set before marking complete.
   */
  async completeGoogleOnboarding(userId: string): Promise<AuthTokens> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.onboardingStatus === OnboardingStatus.COMPLETED) {
      throw new BadRequestException('Onboarding is already completed.');
    }

    // Validate that all required fields are set
    const hasValidRole = AuthService.ONBOARDING_SELF_ASSIGNABLE_ROLES.includes(user.role);
    const hasRealPhone = user.phoneNumber && !user.phoneNumber.startsWith('google_') && !user.phoneNumber.startsWith('temp_');

    if (!hasValidRole) {
      throw new BadRequestException('Please select a valid role before completing onboarding.');
    }

    if (!hasRealPhone) {
      throw new BadRequestException('Please provide a valid phone number before completing onboarding.');
    }

    // Mark onboarding as complete
    user.onboardingStatus = OnboardingStatus.COMPLETED;
    user.onboardingCompleted = true;
    await user.save();

    this.logger.log(`Google onboarding completed for user ${userId}`);

    // Generate fresh tokens so the JWT carries the updated role
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: user.toJSON(),
      onboardingStatus: OnboardingStatus.COMPLETED,
    };
  }
}