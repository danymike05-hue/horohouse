import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

export enum UserRole {
  /** Platform administrator — full access across long-term and short-term modules. */
  ADMIN = 'admin',
  /** Real-estate agent — can list and manage both long-term and short-term properties on behalf of owners. */
  AGENT = 'agent',
  /** Property owner managing long-term rentals (leases, tenants, rental income). */
  LANDLORD = 'landlord',
  /**
   * Property owner managing short-term stays (nightly / weekly bookings).
   * Mirrors the Airbnb "Host" model — the owner self-lists and handles
   * their own availability, pricing, and guest communication.
   */
  HOST = 'host',
  /** Default role for any registered user browsing or inquiring on listings. */
  REGISTERED_USER = 'registered_user',
  /** User who books short-term stays (hotels, vacation rentals, featured houses). */
  GUEST = 'guest',
  /** University student — access to student housing search, roommate matching, and student-verified listings. */
  STUDENT = 'student',
}

/**
 * Tracks Google-OAuth onboarding progress.
 * Users who register via email/password go through a different flow and
 * have this set to 'completed' immediately.
 */
export enum OnboardingStatus {
  /** Account created but no profile info collected yet. */
  NOT_STARTED = 'not_started',
  /** User has selected a role but still needs to provide a phone number. */
  ROLE_SELECTED = 'role_selected',
  /** Role + phone collected; awaiting final review/confirmation. */
  PHONE_PROVIDED = 'phone_provided',
  /** All required onboarding steps finished. */
  COMPLETED = 'completed',
}

// ─── Host profile ─────────────────────────────────────────────────────────────

/**
 * Verification tier for a host — mirrors Airbnb's Superhost / verified host concept.
 */
export enum HostVerificationStatus {
  /** Account created, identity not yet confirmed. */
  UNVERIFIED = 'unverified',
  /** ID / documents uploaded, under review. */
  PENDING = 'pending',
  /** Identity confirmed — host can publish listings and accept bookings. */
  VERIFIED = 'verified',
  /** Documents rejected (expired, wrong type, unreadable). */
  REJECTED = 'rejected',
}

/**
 * Payout method types supported for host earnings disbursement.
 */
export enum PayoutMethod {
  MOBILE_MONEY = 'mobile_money', // MTN / Orange Money (primary in Cameroon & West Africa)
  BANK_TRANSFER = 'bank_transfer',
  PAYPAL = 'paypal',
}

/**
 * Stored payout destination for a host.
 */
export interface HostPayoutAccount {
  method: PayoutMethod;
  /** Phone number for mobile money, account number for bank, email for PayPal. */
  accountIdentifier: string;
  /** e.g. "MTN Cameroon", "Orange Money", "UBA" */
  providerName?: string;
  isDefault: boolean;
  /** ISO 4217 currency code the account receives in, e.g. "XAF" */
  currency: string;
}

export interface PushToken {
  token: string;
  platform: 'ios' | 'android';
  deviceId?: string; // optional, helps dedupe re-installs
  updatedAt: Date;
}

/**
 * Snapshot of a completed payout to the host.
 */
export interface HostPayoutRecord {
  _id?: Types.ObjectId;
  amount: number;
  currency: string;
  method: PayoutMethod;
  /** Booking or period this payout covers */
  reference?: string;
  status: 'pending' | 'processing' | 'paid' | 'failed';
  initiatedAt: Date;
  completedAt?: Date;
  failureReason?: string;
}

/**
 * Sub-profile attached to a user with role === HOST.
 *
 * Design rationale (Airbnb-aligned):
 *  - Identity verification gate  → hosts must be verified before listings go live.
 *  - Superhost tier              → earned automatically from performance metrics.
 *  - Instant-book toggle         → host-level default, overridable per listing.
 *  - Response metrics            → drive search ranking and trust signals.
 *  - Payout accounts             → mobile-money-first for the African market.
 *  - Earnings summary            → lifetime + current-month snapshot.
 */
export interface HostProfile {
  // ── Identity verification ────────────────────────────────────────────────
  verificationStatus: HostVerificationStatus;
  /** Cloudinary URL of the host's government-issued ID. */
  governmentIdUrl?: string;
  /** Cloudinary public_id (kept server-side only, stripped from API responses). */
  governmentIdPublicId?: string;
  verificationSubmittedAt?: Date;
  verificationReviewedAt?: Date;
  verificationRejectionReason?: string;

  // ── Superhost ────────────────────────────────────────────────────────────
  /**
   * True when the host consistently meets high performance thresholds
   * (response rate ≥ 90 %, rating ≥ 4.8, ≥ 10 stays in 12 months, <1 % cancellation).
   * Re-evaluated automatically every quarter.
   */
  isSuperhost: boolean;
  superhostSince?: Date;

  // ── Hosting preferences ──────────────────────────────────────────────────
  /**
   * When true, guests matching the host's requirements can book instantly
   * without waiting for manual approval. Mirrors Airbnb's Instant Book.
   */
  instantBookEnabled: boolean;
  /** Minimum length of stay in nights (e.g. 1 = nightly, 7 = weekly minimum). */
  minNightsDefault: number;
  /** Maximum length of stay in nights (0 = no cap). */
  maxNightsDefault: number;
  /**
   * Advance notice the host needs before a guest can check in (in hours).
   * e.g. 0 = same-day OK, 24 = at least 1 day notice.
   */
  advanceNoticeHours: number;
  /**
   * How far into the future the host keeps their calendar open for bookings.
   * Values: 3 | 6 | 9 | 12 months, or 0 = no limit.
   */
  bookingWindowMonths: number;

  // ── Response metrics ─────────────────────────────────────────────────────
  /** Percentage of inquiries responded to within 24 h (0–100). */
  responseRate?: number;
  /** Median time to first response in minutes. */
  responseTimeMinutes?: number;

  // ── Financials ───────────────────────────────────────────────────────────
  /** Total gross earnings across all bookings, lifetime (in XAF or platform base currency). */
  totalEarnings: number;
  /** Earnings in the current calendar month (reset on 1st). */
  currentMonthEarnings: number;
  /** Number of completed stays (bookings that checked out successfully). */
  completedStays: number;
  /** Platform commission rate applied to this host's payouts (0–1, e.g. 0.12 = 12 %). */
  commissionRate: number;
  /** Registered payout destinations. */
  payoutAccounts: HostPayoutAccount[];
  /** Last 50 payout records for display in the host dashboard. */
  payoutHistory: HostPayoutRecord[];

  // ── House rules (host-level defaults, overridable per listing) ────────────
  petsAllowedDefault: boolean;
  smokingAllowedDefault: boolean;
  eventsAllowedDefault: boolean;
  /** Default check-in window start, 24 h format e.g. "15:00" */
  checkInTimeDefault?: string;
  /** Default check-out time, 24 h format e.g. "11:00" */
  checkOutTimeDefault?: string;

  // ── Co-hosts ─────────────────────────────────────────────────────────────
  /**
   * Other user IDs granted co-host access (can manage calendar, messages, and
   * check-in/out on behalf of the primary host).
   */
  coHostIds: Types.ObjectId[];

  // ── Bio / presentation ───────────────────────────────────────────────────
  /** Short "About me" shown on the host's public profile page. */
  hostBio?: string;
  /** Primary spoken language used with guests (ISO 639-1 codes, e.g. ["fr","en"]). */
  hostLanguages: string[];
  /** City/region the host primarily operates in. */
  operatingCity?: string;
}

// ─── Student verification status ─────────────────────────────────────────────

export enum StudentVerificationStatus {
  /** Student has not yet submitted their ID */
  UNVERIFIED = 'unverified',
  /** ID uploaded, awaiting manual or automated review */
  PENDING = 'pending',
  /** ID confirmed — student gains access to roommate pool and verified listings */
  VERIFIED = 'verified',
  /** ID was rejected (expired, wrong doc type, unreadable) */
  REJECTED = 'rejected',
}

// ─── Student profile subdocument ──────────────────────────────────────────────

export interface StudentProfile {
  /** Full name of the university as it appears on the student ID */
  universityName: string;
  /** e.g. "Faculty of Engineering and Technology" */
  faculty?: string;
  /** e.g. "L1", "L2", "L3", "Master 1", "Master 2", "PhD" */
  studyLevel?: string;
  /** Year they enrolled, e.g. 2023 */
  enrollmentYear?: number;
  /** Cloudinary URL of their university ID photo */
  studentIdUrl?: string;
  /** Cloudinary public_id for the uploaded ID (needed for deletion) */
  studentIdPublicId?: string;
  /** Human-readable verification state */
  verificationStatus: StudentVerificationStatus;
  /** Date the ID was submitted for verification */
  verificationSubmittedAt?: Date;
  /** Date the ID was approved or rejected */
  verificationReviewedAt?: Date;
  /** Admin note on rejection reason, shown to the student */
  verificationRejectionReason?: string;
  /** City of their campus — drives default property search location */
  campusCity: string;
  /** Specific campus or university gate coordinates for commute calculations */
  campusLatitude?: number;
  campusLongitude?: number;
  /** ObjectId linking to their active RoommateProfile document (if created) */
  roommateProfileId?: Types.ObjectId;
  /** Unique referral/ambassador code if the student is a campus ambassador */
  ambassadorCode?: string;
  /** Whether this student is an active campus ambassador */
  isAmbassador: boolean;
  /** Total commissions earned as ambassador (in XAF) */
  ambassadorEarnings?: number;
}

// ─── Existing interfaces (unchanged) ─────────────────────────────────────────

export type TenantStatus = 'active' | 'ended' | 'pending';

export interface TenantRecord {
  _id?: Types.ObjectId;
  tenantName: string;
  tenantEmail?: string;
  tenantPhone?: string;
  tenantUserId?: Types.ObjectId;
  propertyId: Types.ObjectId;
  leaseStart: Date;
  leaseEnd: Date;
  monthlyRent: number;
  depositAmount?: number;
  status: TenantStatus;
  notes?: string;
}

export interface UserPreferences {
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  propertyTypes?: string[];
  cities?: string[];
  amenities?: string[];
  bedrooms?: number[];
  bathrooms?: number[];
  maxRadius?: number;
  minArea?: number;
  maxArea?: number;
  preferredLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };
}

export interface AgentPreferences {
  licenseNumber?: string;
  agency?: string;
  experience?: number;
  specializations?: string[];
  serviceAreas?: string[];
  commissionRate?: number;
  propertyPriceRange?: {
    min: number;
    max: number;
    currency: string;
  };
}

export interface SearchQuery {
  query: string;
  filters: any;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  timestamp: Date;
  resultsCount: number;
}

export interface UserSession {
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
}

// ─── Schema ───────────────────────────────────────────────────────────────────

@Schema({
  timestamps: true,
  autoIndex: true,
})
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ unique: true, sparse: true, lowercase: true, trim: true })
  email?: string;

  @Prop({ required: true, unique: true })
  phoneNumber: string;

  @Prop({ type: String, enum: Object.values(UserRole), default: UserRole.REGISTERED_USER })
  role: UserRole;

  @Prop({ default: null })
  profilePicture?: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Property' }], default: [] })
  favorites: Types.ObjectId[];

  @Prop({ type: Object, default: {} })
  preferences: UserPreferences;

  @Prop({ type: [Object], default: [] })
  searchHistory: SearchQuery[];

  @Prop({
    type: [
      {
        propertyId: { type: Types.ObjectId, ref: 'Property' },
        viewedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  recentlyViewed: Array<{
    propertyId: Types.ObjectId;
    viewedAt: Date;
  }>;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [String], default: [] })
  specialties?: string[];

  @Prop({ type: [String], default: ['English'] })
  languages?: string[];

  @Prop({ type: [String], default: [] })
  serviceAreas?: string[];

  @Prop({ default: false })
  emailVerified: boolean;

  @Prop({ default: false })
  phoneVerified: boolean;

  @Prop({ unique: true, sparse: true })
  googleId?: string;

  @Prop()
  password?: string;

  @Prop({ default: 0 })
  averageRating?: number;

  @Prop({ default: 0 })
  reviewCount?: number;

  @Prop()
  phoneVerificationCode?: string;

  @Prop()
  phoneVerificationExpires?: Date;

  @Prop()
  emailVerificationToken?: string;

  @Prop()
  emailVerificationExpires?: Date;

  @Prop()
  resetPasswordToken?: string;

  @Prop()
  resetPasswordExpires?: Date;

  @Prop({ default: false })
  twoFactorEnabled?: boolean;

  @Prop()
  twoFactorSecret?: string;

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        refreshToken: { type: String, required: true },
        device: { type: String, required: true },
        ipAddress: { type: String, required: true },
        userAgent: { type: String, required: true },
        location: { type: String },
        isActive: { type: Boolean, default: true },
        lastActive: { type: Date, default: Date.now },
        createdAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, required: true },
      },
    ],
    default: [],
  })
  sessions: UserSession[];

  // ── Agent-specific fields ─────────────────────────────────────────────────

  @Prop()
  licenseNumber?: string;

  @Prop()
  agency?: string;

  @Prop()
  bio?: string;

  @Prop()
  website?: string;

  @Prop({ default: 0 })
  propertiesListed?: number;

  @Prop({ default: 0 })
  propertiesSold?: number;

  // ── Landlord-specific fields ──────────────────────────────────────────────

  @Prop({
    type: [
      {
        _id: { type: Types.ObjectId, default: () => new Types.ObjectId() },
        tenantName: { type: String, required: true },
        tenantEmail: { type: String },
        tenantPhone: { type: String },
        tenantUserId: { type: Types.ObjectId, ref: 'User' },
        propertyId: { type: Types.ObjectId, ref: 'Property', required: true },
        leaseStart: { type: Date, required: true },
        leaseEnd: { type: Date, required: true },
        monthlyRent: { type: Number, required: true },
        depositAmount: { type: Number },
        status: { type: String, enum: ['active', 'ended', 'pending'], default: 'active' },
        notes: { type: String },
      },
    ],
    default: [],
  })
  tenants: TenantRecord[];

  @Prop({ default: 0 })
  totalRentalIncome?: number;

  @Prop({ default: 0 })
  occupancyRate?: number;

  // ── Host-specific fields ──────────────────────────────────────────────────

  /**
   * Only populated when role === UserRole.HOST.
   * Follows the same embedded sub-profile pattern as studentProfile.
   */
  @Prop({
    type: {
      // Identity verification
      verificationStatus: {
        type: String,
        enum: Object.values(HostVerificationStatus),
        default: HostVerificationStatus.UNVERIFIED,
      },
      governmentIdUrl: { type: String },
      governmentIdPublicId: { type: String },
      verificationSubmittedAt: { type: Date },
      verificationReviewedAt: { type: Date },
      verificationRejectionReason: { type: String },

      // Superhost
      isSuperhost: { type: Boolean, default: false },
      superhostSince: { type: Date },

      // Hosting preferences
      instantBookEnabled: { type: Boolean, default: false },
      minNightsDefault: { type: Number, default: 1 },
      maxNightsDefault: { type: Number, default: 0 },
      advanceNoticeHours: { type: Number, default: 24 },
      bookingWindowMonths: { type: Number, default: 12 },

      // Response metrics
      responseRate: { type: Number },
      responseTimeMinutes: { type: Number },

      // Financials
      totalEarnings: { type: Number, default: 0 },
      currentMonthEarnings: { type: Number, default: 0 },
      completedStays: { type: Number, default: 0 },
      commissionRate: { type: Number, default: 0.12 }, // 12 % platform cut
      payoutAccounts: {
        type: [
          {
            method: { type: String, enum: Object.values(PayoutMethod), required: true },
            accountIdentifier: { type: String, required: true },
            providerName: { type: String },
            isDefault: { type: Boolean, default: false },
            currency: { type: String, default: 'XAF' },
          },
        ],
        default: [],
      },
      payoutHistory: {
        type: [
          {
            _id: { type: Types.ObjectId, default: () => new Types.ObjectId() },
            amount: { type: Number, required: true },
            currency: { type: String, required: true },
            method: { type: String, enum: Object.values(PayoutMethod), required: true },
            reference: { type: String },
            status: {
              type: String,
              enum: ['pending', 'processing', 'paid', 'failed'],
              default: 'pending',
            },
            initiatedAt: { type: Date, required: true },
            completedAt: { type: Date },
            failureReason: { type: String },
          },
        ],
        default: [],
      },

      // House rules defaults
      petsAllowedDefault: { type: Boolean, default: false },
      smokingAllowedDefault: { type: Boolean, default: false },
      eventsAllowedDefault: { type: Boolean, default: false },
      checkInTimeDefault: { type: String, default: '15:00' },
      checkOutTimeDefault: { type: String, default: '11:00' },

      // Co-hosts
      coHostIds: { type: [{ type: Types.ObjectId, ref: 'User' }], default: [] },

      // Bio / presentation
      hostBio: { type: String },
      hostLanguages: { type: [String], default: [] },
      operatingCity: { type: String },
    },
    default: null,
  })
  hostProfile?: HostProfile;

  // ── Student-specific fields ───────────────────────────────────────────────

  /**
   * Only populated when role === UserRole.STUDENT.
   */
  @Prop({
    type: {
      universityName: { type: String },
      faculty: { type: String },
      studyLevel: { type: String },
      enrollmentYear: { type: Number },
      studentIdUrl: { type: String },
      studentIdPublicId: { type: String },
      verificationStatus: {
        type: String,
        enum: Object.values(StudentVerificationStatus),
        default: StudentVerificationStatus.UNVERIFIED,
      },
      verificationSubmittedAt: { type: Date },
      verificationReviewedAt: { type: Date },
      verificationRejectionReason: { type: String },
      campusCity: { type: String },
      campusLatitude: { type: Number },
      campusLongitude: { type: Number },
      roommateProfileId: { type: Types.ObjectId, ref: 'RoommateProfile' },
      ambassadorCode: { type: String },
      isAmbassador: { type: Boolean, default: false },
      ambassadorEarnings: { type: Number, default: 0 },
    },
    default: null,
  })
  studentProfile?: StudentProfile;

  // ── Notification preferences ──────────────────────────────────────────────

  @Prop({ default: true })
  emailNotifications: boolean;

  @Prop({ default: true })
  smsNotifications: boolean;

  @Prop({ default: true })
  pushNotifications: boolean;

  @Prop({
  type: [
    {
      token: { type: String, required: true },
      platform: { type: String, enum: ['ios', 'android'], required: true },
      deviceId: { type: String },
      updatedAt: { type: Date, default: Date.now },
    },
  ],
  default: [],
})
pushTokens: PushToken[];
  // ── Location ─────────────────────────────────────────────────────────────

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      default: [0, 0],
    },
  })
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop()
  address?: string;

  @Prop()
  city?: string;

  @Prop()
  country?: string;

  // ── Onboarding ────────────────────────────────────────────────────────────

  @Prop({ default: false })
  onboardingCompleted?: boolean;

  @Prop({
    type: String,
    enum: Object.values(OnboardingStatus),
    default: OnboardingStatus.COMPLETED,
  })
  onboardingStatus: OnboardingStatus;

  @Prop({ type: Object, default: null })
  agentPreferences?: AgentPreferences;

  createdAt: Date;
  updatedAt: Date;

  _id: Types.ObjectId;
}

// ─── Schema factory & indexes ─────────────────────────────────────────────────

export const UserSchema = SchemaFactory.createForClass(User);

// Geospatial
UserSchema.index({ location: '2dsphere' });
UserSchema.index({ 'preferences.preferredLocation': '2dsphere' });

// Existing indexes
UserSchema.index({ 'recentlyViewed.propertyId': 1 });
UserSchema.index({ 'sessions.id': 1 });
UserSchema.index({ 'sessions.refreshToken': 1 });
UserSchema.index({ 'sessions.expiresAt': 1 });
UserSchema.index({ 'sessions.isActive': 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ city: 1 });
UserSchema.index({ country: 1 });
UserSchema.index({ isActive: 1 });

// Host-specific indexes
// Admin verification queue
UserSchema.index({ 'hostProfile.verificationStatus': 1 });
// Superhost filter for search ranking
UserSchema.index({ 'hostProfile.isSuperhost': 1 });
// Payout processing queue — find hosts with pending payouts
UserSchema.index({ 'hostProfile.payoutHistory.status': 1 });
// Hosts by city for ops/support filtering
UserSchema.index({ role: 1, 'hostProfile.operatingCity': 1 });
// Notification
UserSchema.index({ 'pushTokens.token': 1 });
// Student-specific indexes
UserSchema.index({ 'studentProfile.verificationStatus': 1 });
UserSchema.index({ 'studentProfile.ambassadorCode': 1 }, { sparse: true });
UserSchema.index({ 'studentProfile.roommateProfileId': 1 }, { sparse: true });
UserSchema.index({ role: 1, 'studentProfile.campusCity': 1 });

// Virtual id getter
UserSchema.virtual('id').get(function (this: UserDocument) {
  return this._id.toString();
});

// JSON transformation — hide sensitive fields
UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret: any) => {
    delete ret._id;
    delete ret.password;
    delete ret.phoneVerificationCode;
    delete ret.emailVerificationToken;
    delete ret.resetPasswordToken;
    // Strip host government ID Cloudinary public_id
    if (ret.hostProfile?.governmentIdPublicId) {
      delete ret.hostProfile.governmentIdPublicId;
    }
    // Strip student ID Cloudinary public_id
    if (ret.studentProfile?.studentIdPublicId) {
      delete ret.studentProfile.studentIdPublicId;
    }
    // Strip refresh tokens from sessions
    if (ret.sessions && Array.isArray(ret.sessions)) {
      ret.sessions = ret.sessions.map((session: any) => {
        const { refreshToken, ...sessionWithoutToken } = session;
        return sessionWithoutToken;
      });
    }
    return ret;
  },
});