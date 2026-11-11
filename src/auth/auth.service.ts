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

/** Where the Google callback may send the browser */
export interface OAuthRedirectTarget {
  /** rejected = a return link we don't allow: show an error, issue nothing */
  kind: 'app' | 'web' | 'rejected';
  /** Why it was rejected (shown on the error page / logs) */
  reason?: string;
  url: string;
  /** PKCE challenge from the app's redirect URI (`cc` param) */
  challenge?: string;
  /** "Connect Google" for a signed-in user (`lt` param) instead of a sign-in */
  linkToken?: string;
}

// ── Small helpers ─────────────────────────────────────────────────────────
const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const sha256b64url = (v: string) => crypto.createHash('sha256').update(v).digest('base64url');
const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Case-insensitive exact match without treating the email as a regex */
const emailQuery = (email: string) => ({ $regex: `^${escapeRegex(email.trim().toLowerCase())}$`, $options: 'i' });
const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const isPlaceholderPhone = (p?: string) => !p || p.startsWith('google_') || p.startsWith('temp_');
/**
 * Sign-up is really finished only with a real phone. The schema defaults
 * onboardingStatus to COMPLETED, so Google accounts made before onboarding
 * existed read "completed" while still having the google_… placeholder —
 * the app then sent them to the role/phone steps and the server refused them.
 */
const onboardingDone = (u: { onboardingStatus?: string; phoneNumber?: string }) =>
  u.onboardingStatus === OnboardingStatus.COMPLETED && !(u.phoneNumber || '').startsWith('google_');

const MAX_CODE_ATTEMPTS = 5;
const OAUTH_CODE_TTL_MS = 2 * 60 * 1000;
/** A refresh token replaced less than this long ago is still accepted (two requests racing) */
const ROTATION_GRACE_MS = 30 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Compared against when the email has no password, so both cases take the same time */
  private static readonly DUMMY_HASH = bcrypt.hashSync('horohouse-timing-placeholder', 12);
  
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

      // No account with this number: answer the same way but send nothing.
      // (Before, this upserted an empty user per number, which then blocked
      // registering that number and cost an SMS for every random request.)
      if (!existing) {
        this.logger.log(`Phone code requested for unknown number ${formattedPhone.slice(0, 5)}…`);
        return { message: 'Verification code sent successfully' };
      }

      const verificationCode = this.smsService.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store only a hash of the code, and reset the wrong-attempt counter
      await this.userModel.updateOne(
        { _id: (existing as any)._id },
        {
          phoneVerificationCode: sha256(String(verificationCode)),
          phoneVerificationExpires: expiresAt,
          phoneVerificationSentAt: new Date(),
          phoneVerificationAttempts: 0,
        },
      );

      // Send SMS
      const smsSent = await this.smsService.sendVerificationCode(formattedPhone, verificationCode);

      if (!smsSent) {
        throw new BadRequestException('Failed to send verification code');
      }

      this.logger.log(`Verification code sent to ${formattedPhone.slice(0, 5)}…`);

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

      this.logger.log(`New user registered with phone: ${formattedPhone.slice(0, 5)}…`);

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

    const formattedPhone = phoneNumber ? this.smsService.formatPhoneNumber(phoneNumber) : undefined;

    const [emailTaken, phoneTaken] = await Promise.all([
      this.userModel.exists({ email: emailQuery(normalizedEmail) }),
      formattedPhone ? this.userModel.exists({ phoneNumber: formattedPhone }) : Promise.resolve(null),
    ]);

    // Separate messages so the app can send the person to the right field
    if (emailTaken) {
      throw new ConflictException({ message: 'An account already exists with this email', field: 'email', code: 'EMAIL_TAKEN' });
    }
    if (phoneTaken) {
      throw new ConflictException({ message: 'This phone number is already used by another account', field: 'phone', code: 'PHONE_TAKEN' });
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
      const user = await this.userModel
        .findOne({ phoneNumber: formattedPhone })
        .select('+phoneVerificationCode +phoneVerificationAttempts');

      // Same answer whether or not the number has an account
      if (!user) {
        throw new UnauthorizedException('Invalid verification code');
      }
      if (!user.isActive) {
        throw new UnauthorizedException('This account is deactivated');
      }

      await this.checkPhoneCode(user, verificationCode);

      this.logger.log(`User logged in with phone: ${formattedPhone.slice(0, 5)}…`);

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

      // Case-insensitive lookup (password is select:false)
      const user = await this.userModel
        .findOne({ email: emailQuery(normalizedEmail) })
        .select('+password');

      if (!user || !user.password) {
        // Same work and message either way, so timing doesn't reveal accounts
        await bcrypt.compare(password, AuthService.DUMMY_HASH);
        throw new UnauthorizedException({
          message: 'Incorrect email or password',
          // Google-only account: tell the app to offer "Continue with Google"
          ...(user && !user.password && user.googleId ? { code: 'USE_GOOGLE' } : {}),
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Incorrect email or password');
      }

      if (!user.isActive) {
        throw new UnauthorizedException({ message: 'This account is deactivated', code: 'ACCOUNT_DEACTIVATED' });
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
   * Google sign-in: find or create the account. Does not issue tokens; the
   * callback either hands the app a one-time code or (web) sets cookies.
   */
  async googleSignIn(dto: GoogleAuthDto & { emailVerified?: boolean }): Promise<{ user: UserDocument; isNewUser: boolean }> {
    const { googleId, name, picture } = dto;
    const email = (dto.email || '').trim().toLowerCase();

    if (!googleId || !email) {
      throw new UnauthorizedException('Google did not return an email address');
    }
    if (dto.emailVerified === false) {
      throw new UnauthorizedException('Your Google email address is not verified');
    }

    // The Google id wins; otherwise link by (verified) email
    // Typed explicitly: some Mongoose versions infer a different document type
    // for the second query, which breaks the reassignment
    let user: UserDocument | null = (await this.userModel.findOne({ googleId }).select('+password').exec()) as any;
    if (!user) user = (await this.userModel.findOne({ email: emailQuery(email) }).select('+password').exec()) as any;

    let isNewUser = false;

    if (!user) {
      // Create new user — onboarding is NOT_STARTED
      isNewUser = true;
      user = await this.userModel.create({
        googleId,
        name,
        email,
        profilePicture: picture,
        phoneNumber: `google_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`, // Temporary placeholder
        role: UserRole.REGISTERED_USER,       // Temporary — will be replaced during onboarding
        emailVerified: true,
        phoneVerified: false,
        onboardingCompleted: false,
        onboardingStatus: OnboardingStatus.NOT_STARTED,
      });

      this.logger.log(`New user created via Google OAuth: ${user._id}`);

      // Send welcome email
      if (user.email) {
        void this.emailService.sendWelcomeEmail(user.email, user.name).catch(() => undefined);
      }
      return { user, isNewUser };
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account is deactivated');
    }

    // Someone may have signed up with this email and a password without ever
    // proving they own the inbox ("pre-hijacking"). Google just proved the real
    // owner is here, so drop that unproven password and its sessions before
    // linking. The owner can set a password later with "Forgot password".
    if (!user.googleId && !user.emailVerified && user.password) {
      this.logger.warn(`Google sign-in for unverified email account ${user._id}: removing unverified password and sessions`);
      user.password = undefined;
      user.sessions = [];
    }

    // Existing user — link Google if not already linked, but NEVER overwrite role/phone
    if (!user.googleId) user.googleId = googleId;
    if (!user.profilePicture && picture) user.profilePicture = picture;
    user.emailVerified = true;

    // IMPORTANT: only flag onboarding-required if the user has NOT already completed it.
    // Never downgrade a COMPLETED onboarding status.
    const explicitlyCompleted =
      (user.onboardingStatus === OnboardingStatus.COMPLETED || user.onboardingCompleted === true) &&
      !(user.phoneNumber || '').startsWith('google_');

    // Implicit completion: users registered via email/phone before
    // onboarding fields existed — they have a real phone + valid role
    const implicitlyCompleted =
      !isPlaceholderPhone(user.phoneNumber) &&
      user.role !== UserRole.REGISTERED_USER &&
      AuthService.ONBOARDING_SELF_ASSIGNABLE_ROLES.includes(user.role);

    if (explicitlyCompleted || implicitlyCompleted) {
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
    this.logger.log(`Existing user signed in via Google: ${user._id}, onboardingStatus: ${user.onboardingStatus}`);
    return { user, isNewUser };
  }

  /**
   * Google OAuth for the web app: sign in and issue tokens straight away
   * (the web callback sets httpOnly cookies).
   */
  async googleAuth(dto: GoogleAuthDto & { emailVerified?: boolean }, req?: any): Promise<AuthTokens> {
    const { user, isNewUser } = await this.googleSignIn(dto);
    const tokens = await this.generateTokens(user, req);
    return {
      ...tokens,
      user: user.toJSON() as any,
      isNewUser,
      onboardingStatus: user.onboardingStatus,
    };
  }

  /**
   * Decide where the Google callback may redirect. Only the app's own schemes
   * and the configured web origins are allowed — anything else would let a
   * crafted link send the sign-in result to someone else's site.
   */
  resolveOAuthRedirect(state?: string): OAuthRedirectTarget {
    const webBase = (this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/+$/, '');
    const fallback: OAuthRedirectTarget = { kind: 'web', url: `${webBase}/auth/callback` };
    if (!state) return fallback;

    let parsed: URL;
    try {
      parsed = new URL(state);
    } catch {
      return { kind: 'rejected', url: '', reason: 'The return link is not a valid URL.' };
    }

    const allowExpoGo =
      this.configService.get<string>('OAUTH_ALLOW_EXPO_GO') === 'true' ||
      this.configService.get<string>('NODE_ENV') !== 'production';
    // App schemes from app.json "scheme" (default horohouse); override with
    // OAUTH_APP_SCHEMES=horohouse,myotherscheme
    const configured = (this.configService.get<string>('OAUTH_APP_SCHEMES') || 'horohouse')
      .split(',').map((x) => x.trim().toLowerCase().replace(/:\/*$/, '')).filter(Boolean);
    const appSchemes = [
      ...configured.flatMap((x) => [`${x}:`, `exp+${x}:`]),
      ...(allowExpoGo ? ['exp:', 'exps:'] : []),
    ];

    if (appSchemes.includes(parsed.protocol)) {
      const challenge = parsed.searchParams.get('cc') || undefined;
      const linkToken = parsed.searchParams.get('lt') || undefined;
      // Drop anything the app shouldn't receive from the start URL
      for (const k of ['code', 'token', 'refresh', 'error', 'isNewUser', 'onboardingStatus', 'lt', 'linked']) parsed.searchParams.delete(k);
      return { kind: 'app', url: parsed.toString(), challenge, linkToken };
    }

    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      const allowed = [webBase, ...(this.configService.get<string>('OAUTH_WEB_REDIRECTS') || '').split(',')]
        .map((o) => o.trim())
        .filter(Boolean)
        .map((o) => {
          try { return new URL(o).origin; } catch { return null; }
        })
        .filter(Boolean) as string[];
      if (allowed.includes(parsed.origin)) return { kind: 'web', url: parsed.toString() };
    }

    this.logger.warn(`Rejected OAuth redirect target: ${parsed.protocol}//${parsed.host}`);
    const reason = parsed.protocol === 'exp:' || parsed.protocol === 'exps:'
      ? 'Expo Go links are turned off on this server. Set OAUTH_ALLOW_EXPO_GO=true in the backend .env (or use a development build).'
      : `The return link scheme "${parsed.protocol}" is not allowed. Add it to OAUTH_APP_SCHEMES (app) or OAUTH_WEB_REDIRECTS (web) in the backend .env.`;
    return { kind: 'rejected', url: '', reason };
  }

  /**
   * Store a one-time code (2 min) for the app. It is bound to the app's PKCE
   * challenge, so only the app that started the sign-in can use it.
   */
  async issueOAuthCode(user: UserDocument, challenge: string, isNewUser: boolean): Promise<string> {
    if (!/^[A-Za-z0-9_-]{43,128}$/.test(challenge)) {
      throw new BadRequestException('Missing or invalid sign-in challenge');
    }
    const code = crypto.randomBytes(32).toString('base64url');
    await this.userModel.updateOne(
      { _id: user._id },
      {
        oauthCodeHash: sha256(code),
        oauthCodeChallenge: challenge,
        oauthCodeExpires: new Date(Date.now() + OAUTH_CODE_TTL_MS),
        oauthCodeNewUser: isNewUser,
      },
    );
    return code;
  }

  /**
   * App side of Google sign-in: swap the one-time code + PKCE verifier for tokens.
   */
  async exchangeOAuthCode(code: string, codeVerifier: string, req?: any): Promise<AuthTokens> {
    // Atomically consume the code so it works exactly once
    const consumed = await this.userModel
      .findOneAndUpdate(
        { oauthCodeHash: sha256(code), oauthCodeExpires: { $gt: new Date() } },
        { $unset: { oauthCodeHash: 1, oauthCodeChallenge: 1, oauthCodeExpires: 1, oauthCodeNewUser: 1 } },
      )
      .select('+oauthCodeChallenge +oauthCodeNewUser');

    if (!consumed || !consumed.oauthCodeChallenge) {
      throw new UnauthorizedException('This sign-in link has expired. Please try again.');
    }
    if (!safeEqual(sha256b64url(codeVerifier), consumed.oauthCodeChallenge)) {
      this.logger.warn(`OAuth code for ${consumed._id} used with a wrong verifier`);
      throw new UnauthorizedException('This sign-in link was not started on this device.');
    }

    const user = await this.userModel.findById(consumed._id);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    const tokens = await this.generateTokens(user, req);
    return {
      ...tokens,
      user: user.toJSON(),
      isNewUser: !!consumed.oauthCodeNewUser,
      onboardingStatus: user.onboardingStatus,
    };
  }

  // ── Connect Google to the signed-in account ───────────────────────────────

  /** Step 1 (signed in): a one-time token the app puts in the Google redirect */
  async createGoogleLinkIntent(userId: string): Promise<{ linkToken: string }> {
    const linkToken = crypto.randomBytes(24).toString('base64url');
    await this.userModel.updateOne(
      { _id: userId },
      { oauthLinkHash: sha256(linkToken), oauthLinkExpires: new Date(Date.now() + 10 * 60 * 1000) },
    );
    return { linkToken };
  }

  /**
   * Step 2 (Google callback): attach this Google account to the user who asked.
   * Refused if the Google account already belongs to someone else.
   */
  async linkGoogle(linkToken: string, google: { googleId: string; picture?: string; emailVerified?: boolean }): Promise<void> {
    if (!google.googleId) throw new UnauthorizedException('Google did not return an account id');
    if (google.emailVerified === false) throw new UnauthorizedException('Your Google email address is not verified');

    const user = await this.userModel
      .findOneAndUpdate(
        { oauthLinkHash: sha256(linkToken), oauthLinkExpires: { $gt: new Date() } },
        { $unset: { oauthLinkHash: 1, oauthLinkExpires: 1 } },
      )
      .exec();
    if (!user) throw new UnauthorizedException('This link has expired. Please try again.');

    const owner = await this.userModel.findOne({ googleId: google.googleId }).select('_id').lean().exec();
    if (owner && String((owner as any)._id) !== String(user._id)) {
      throw new ConflictException({ message: 'This Google account is already used by another HoroHouse account', code: 'GOOGLE_IN_USE' });
    }

    const $set: Record<string, any> = { googleId: google.googleId };
    if (!user.profilePicture && google.picture) $set.profilePicture = google.picture;
    await this.userModel.updateOne({ _id: user._id }, { $set });
    this.logger.log(`Google linked to user ${user._id}`);
  }

  /**
   * Does an account exist for this email? Lets the app send people to "Log in"
   * instead of failing at the end of sign-up (registration reveals this anyway).
   */
  async checkEmail(email: string): Promise<{ exists: boolean; hasPassword: boolean; hasGoogle: boolean }> {
    const user = await this.userModel
      .findOne({ email: emailQuery(email) })
      .select('+password')
      .lean();
    return {
      exists: !!user,
      hasPassword: !!(user as any)?.password,
      hasGoogle: !!(user as any)?.googleId,
    };
  }

  /**
   * Verify phone number
   */
  async verifyPhone(dto: VerifyPhoneDto): Promise<{ message: string }> {
    try {
      const { phoneNumber, verificationCode } = dto;

      const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);

      const user = await this.userModel
        .findOne({ phoneNumber: formattedPhone })
        .select('+phoneVerificationCode +phoneVerificationAttempts');

      if (!user) {
        throw new UnauthorizedException('Invalid verification code');
      }

      await this.checkPhoneCode(user, verificationCode);

      return { message: 'Phone number verified successfully' };
    } catch (error) {
      this.logger.error('Phone verification failed:', error);
      throw error;
    }
  }

  /**
   * Check an SMS code (stored hashed). Five wrong tries burn the code, so a
   * 6-digit code can't be guessed. On success the phone is marked verified.
   */
  private async checkPhoneCode(user: UserDocument, code: string): Promise<void> {
    if (!user.phoneVerificationCode || !user.phoneVerificationExpires) {
      throw new UnauthorizedException('No verification code found. Please request a new one.');
    }
    if (user.phoneVerificationExpires < new Date()) {
      throw new UnauthorizedException('Verification code has expired');
    }
    if ((user.phoneVerificationAttempts ?? 0) >= MAX_CODE_ATTEMPTS) {
      throw new UnauthorizedException('Too many wrong codes. Please request a new one.');
    }
    const stored = user.phoneVerificationCode;
    const given = String(code ?? '').trim();
    // Codes sent before this update were stored in clear (they expire within 10 min)
    const ok = stored.length === 64 ? safeEqual(stored, sha256(given)) : safeEqual(stored, given);
    if (!ok) {
      await this.userModel.updateOne({ _id: user._id }, { $inc: { phoneVerificationAttempts: 1 } });
      throw new UnauthorizedException('Invalid verification code');
    }
    user.phoneVerified = true;
    user.phoneVerificationCode = undefined;
    user.phoneVerificationExpires = undefined;
    user.phoneVerificationAttempts = 0;
    await user.save();
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

      const hashedIncoming = sha256(refreshToken);
      const now = Date.now();

      // The token says which session it belongs to; older tokens may not
      let session: any = payload?.sessionId
        ? user.sessions.find(s => s.id === payload.sessionId && s.isActive)
        : user.sessions.find(s => s.isActive && (s.refreshToken === hashedIncoming || s.refreshToken === refreshToken));

      if (!session) {
        throw new UnauthorizedException('Invalid refresh token - session not found');
      }

      // Each refresh token works once. The current one is stored hashed (or in
      // clear for sessions rotated before this fix); the previous one is still
      // accepted for a few seconds in case two requests refreshed at once.
      const isCurrent = session.refreshToken === hashedIncoming || session.refreshToken === refreshToken;
      const isRecentPrev =
        session.prevRefreshToken === hashedIncoming &&
        session.rotatedAt && now - new Date(session.rotatedAt).getTime() < ROTATION_GRACE_MS;

      if (!isCurrent && !isRecentPrev) {
        // An old token came back: it was copied. End this session everywhere.
        this.logger.warn(`Refresh token reuse for user ${user._id}, session ${session.id}: session revoked`);
        user.sessions = user.sessions.filter(s => s.id !== session.id);
        await user.save();
        throw new UnauthorizedException('Session ended. Please log in again.');
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
  async changePassword(userId: string, currentPassword: string, newPassword: string, currentSessionId?: string): Promise<{ message: string }> {
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

    // Update password and sign out every other device
    user.password = hashedNewPassword;
    user.sessions = currentSessionId ? user.sessions.filter(s => s.id === currentSessionId) : [];
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

      // Older sessions stored placeholders ("Unknown Browser on Unknown OS",
      // "Unknown Location"); show something readable or nothing instead
      return plainSessions.map((session: any) => ({
        ...session,
        device: !session.device || /unknown/i.test(session.device)
          ? AuthService.deviceFromUserAgent(session.userAgent)
          : session.device,
        location: session.location && !/unknown|local network/i.test(session.location) ? session.location : undefined,
        refreshToken: undefined,
        prevRefreshToken: undefined,
        ipAddress: undefined,
        userAgent: undefined,
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
      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      const doc = await this.userModel.findById(userId);
      if (!doc) throw new NotFoundException('User not found');

      if (!doc.email) {
        throw new BadRequestException('User does not have an email address');
      }

      if (doc.emailVerified) {
        throw new BadRequestException('Email is already verified');
      }

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      await this.userModel.findByIdAndUpdate(userId, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expiresAt
      });

      await this.emailService.sendEmailVerification(doc.email, doc.name, verificationToken);
      this.logger.log(`Email verification resent to user ${userId}`);

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
      if (isPlaceholderPhone(user.phoneNumber)) {
        throw new BadRequestException('Add a phone number to your profile first');
      }

      // Generate new verification code
      const verificationCode = this.smsService.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      await this.userModel.findByIdAndUpdate(userId, {
        phoneVerificationCode: sha256(String(verificationCode)),
        phoneVerificationExpires: expiresAt,
        phoneVerificationSentAt: new Date(),
        phoneVerificationAttempts: 0,
      });

      // Send SMS
      const smsSent = await this.smsService.sendVerificationCode(user.phoneNumber, verificationCode);

      if (!smsSent) {
        throw new BadRequestException('Failed to send verification code');
      }

      this.logger.log(`Phone verification resent to user ${userId}`);

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
      const user = await this.userModel.findOne({ email: emailQuery(normalizedEmail) });

      // Always return success message (don't reveal if email exists)
      if (!user || !user.isActive) {
        this.logger.log('Password reset requested for an unknown or inactive email');
        return { message: 'If an account exists with this email, you will receive a password reset link shortly.' };
      }

      // Google-only accounts get the email too: it's how they set a first password
      // (needed before they can disconnect Google). They own the inbox anyway.

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
      }).select('+password +resetPasswordToken');

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
      // jsonwebtoken reads a number as SECONDS (this used to pass milliseconds,
      // which made tokens last 1000× longer than configured)
      expiresIn: Math.floor(this.parseTokenExpiration(this.configService.get<string>('JWT_EXPIRATION', '1h')) / 1000),
    };

    const refreshTokenOptions: JwtSignOptions = {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      // jsonwebtoken reads a number as SECONDS (this used to pass milliseconds,
      // which made tokens last 1000× longer than configured)
      expiresIn: Math.floor(this.parseTokenExpiration(this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d')) / 1000),
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, accessTokenOptions),
      // Unique id so every rotation yields a different token, even within one second
      this.jwtService.signAsync(payload, { ...refreshTokenOptions, jwtid: crypto.randomUUID() }),
    ]);

    // Create or update session
    if (!existingSessionId) {
      const refreshTokenExpirationTime = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d');
      const expirationMs = this.parseTokenExpiration(refreshTokenExpirationTime);
      const expiresAt = new Date(Date.now() + expirationMs);

      const deviceInfo = req?.body?.deviceInfo || {};
      const userAgent = req?.headers?.['user-agent'] || 'Unknown';
      const ipAddress = this.getClientIp(req);

      const hashedRefreshToken = sha256(refreshToken);

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
      // Rotate: store the new token's hash (it used to be stored in clear here),
      // remember the previous one briefly, and keep the session alive while used
      const sessionIndex = user.sessions.findIndex(s => s.id === existingSessionId);
      if (sessionIndex !== -1) {
        const sess = user.sessions[sessionIndex];
        const prev = sess.refreshToken;
        sess.prevRefreshToken = prev && prev.length === 64 ? prev : sha256(prev || '');
        sess.rotatedAt = new Date();
        sess.refreshToken = sha256(refreshToken);
        sess.lastActive = new Date();
        // Sessions made before location lookup existed get one now
        if (req && (!sess.location || /unknown|local network/i.test(sess.location))) {
          sess.ipAddress = this.getClientIp(req);
          sess.location = await this.getLocationFromIp(sess.ipAddress);
        }
        sess.expiresAt = new Date(
          Date.now() + this.parseTokenExpiration(this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d')),
        );
        user.markModified('sessions');
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
    // Behind Railway's proxy req.ip is the proxy; the client is the first
    // x-forwarded-for entry
    const fwd = req.headers?.['x-forwarded-for'];
    const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
    return first ||
      req.headers?.['x-real-ip'] ||
      req.ip ||
      req.socket?.remoteAddress ||
      'Unknown';
  }

  /**
   * Helper method to parse device information
   */
  private parseDeviceInfo(userAgent: string, deviceInfo?: any): string {
    // Sent by the app (model + OS); plain text only, kept short
    if (typeof deviceInfo?.device === 'string' && deviceInfo.device.trim()) {
      return deviceInfo.device.replace(/[^\p{L}\p{N} .,'’()·+_-]/gu, '').trim().slice(0, 80) || 'HoroHouse app';
    }
    return AuthService.deviceFromUserAgent(userAgent);
  }

  /** Readable name from a user agent, including the app's own (okhttp / CFNetwork) */
  static deviceFromUserAgent(userAgent?: string): string {
    const ua = String(userAgent ?? '').toLowerCase();
    if (ua.startsWith('okhttp') || (ua.includes('android') && !ua.includes('mozilla'))) return 'Android phone · HoroHouse app';
    if (ua.includes('cfnetwork') || ua.includes('darwin')) return 'iPhone · HoroHouse app';
    if (ua.includes('expo')) return 'HoroHouse app';

    let browser = '';
    let os = '';

    // Detect browser (Edge and Opera also say "chrome", so check them first)
    if (ua.includes('edg/')) browser = 'Edge';
    else if (ua.includes('opr/') || ua.includes('opera')) browser = 'Opera';
    else if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari')) browser = 'Safari';

    // Detect OS
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('macintosh') || ua.includes('mac os x')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
    // "linux" is also in Android UAs
    if (ua.includes('android')) os = 'Android';

    if (browser && os) return `${browser} · ${os}`;
    return browser || os || 'Unknown device';
  }

  /**
   * Helper method to get location from IP (mock implementation)
   */
  /**
   * City, country from the IP (ip-api.com, free tier, no key). Returns ''
   * when unknown so the app simply shows nothing. Turn off with SESSION_GEOIP=off.
   * Results are cached for a day; a slow lookup never holds up sign-in for more than 1.5 s.
   */
  private static geoCache = new Map<string, { at: number; value: string }>();
  private async getLocationFromIp(ipAddress: string): Promise<string> {
    const ip = String(ipAddress ?? '').replace(/^::ffff:/, '');
    if (!ip || ip === 'Unknown' || this.configService.get<string>('SESSION_GEOIP') === 'off') return '';
    // Private / proxy ranges have no location
    if (/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|169\.254\.)/.test(ip) || ip === '::1' || /^f[cd]/i.test(ip)) return '';

    const hit = AuthService.geoCache.get(ip);
    if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.value;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    try {
      const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,country`, { signal: ctrl.signal });
      const data: any = await res.json();
      const value = data?.status === 'success' ? [data.city, data.country].filter(Boolean).join(', ').slice(0, 80) : '';
      if (AuthService.geoCache.size > 5000) AuthService.geoCache.clear();
      AuthService.geoCache.set(ip, { at: Date.now(), value });
      return value;
    } catch {
      return '';
    } finally {
      clearTimeout(timer);
    }
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

      // A deactivated host's listings must not stay bookable
      try {
        const Property = this.userModel.db.model('Property');
        const res = await Property.updateMany({ ownerId: user._id, isActive: true }, { $set: { isActive: false } }).exec();
        if (res.modifiedCount) this.logger.log(`Hid ${res.modifiedCount} listing(s) of deactivated user ${userId}`);
      } catch (e: any) {
        this.logger.warn(`Could not hide listings of deactivated user ${userId}: ${e?.message}`);
      }

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
    UserRole.STUDENT,
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
      onboardingStatus: onboardingDone(user) ? OnboardingStatus.COMPLETED
        : user.onboardingStatus === OnboardingStatus.COMPLETED ? OnboardingStatus.NOT_STARTED : user.onboardingStatus,
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
    if (onboardingDone(user)) {
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
    if (onboardingDone(user)) {
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
  async completeGoogleOnboarding(userId: string, req?: any, currentSessionId?: string): Promise<AuthTokens> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (onboardingDone(user)) {
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

    // Generate fresh tokens so the JWT carries the updated role — on the same
    // session (it used to open a second, unnamed session for every sign-up)
    const hasSession = !!currentSessionId && user.sessions.some(s => s.id === currentSessionId && s.isActive);
    const tokens = await this.generateTokens(user, req, hasSession ? currentSessionId : undefined);

    return {
      ...tokens,
      user: user.toJSON(),
      onboardingStatus: OnboardingStatus.COMPLETED,
    };
  }
}