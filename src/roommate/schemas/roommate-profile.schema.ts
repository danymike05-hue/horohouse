import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RoommateProfileDocument = RoommateProfile & Document;

// ─── Enums ────────────────────────────────────────────────────────────────────

export enum SleepSchedule {
  EARLY_BIRD = 'early_bird',   // Sleeps before 22:00, up before 07:00
  NIGHT_OWL  = 'night_owl',   // Sleeps after 00:00, up after 09:00
  FLEXIBLE   = 'flexible',
}

export enum CleanlinessLevel {
  VERY_NEAT = 'very_neat',     // Everything in its place at all times
  NEAT      = 'neat',          // Generally tidy, cleans weekly
  RELAXED   = 'relaxed',       // Comfortable with some clutter
}

export enum SocialHabit {
  INTROVERTED      = 'introverted',       // Prefers quiet, rarely has guests
  BALANCED         = 'balanced',          // Occasional guests, respects quiet hours
  SOCIAL           = 'social',            // Frequently has friends over
}

export enum StudyHabit {
  HOME_STUDIER  = 'home_studier',   // Studies mostly at home — needs quiet
  LIBRARY_GOER  = 'library_goer',   // Studies outside — home is relaxed
  MIXED         = 'mixed',
}

export enum RoommateMode {
  /** Student has a spare bed in their current place and wants a co-tenant */
  HAVE_ROOM = 'have_room',
  /** Student needs a place and wants to co-lease a new property with someone */
  NEED_ROOM = 'need_room',
}

export enum MatchStatus {
  PENDING   = 'pending',    // One side expressed interest, other hasn't responded
  MATCHED   = 'matched',    // Both sides accepted — chat unlocked
  REJECTED  = 'rejected',   // One side declined
  EXPIRED   = 'expired',    // No response within 7 days
}

// ─── Schema ───────────────────────────────────────────────────────────────────

@Schema({ timestamps: true })
export class RoommateProfile {
  /** References the User document */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: Types.ObjectId;

  /** References the StudentProfile document */
  @Prop({ type: Types.ObjectId, ref: 'StudentProfile', required: true, index: true })
  studentProfileId: Types.ObjectId;

  // ── Mode ──────────────────────────────────────────────────────────────────

  @Prop({
    type: String,
    enum: Object.values(RoommateMode),
    required: true,
    index: true,
  })
  mode: RoommateMode;

  /**
   * "have_room" only — the Property listing that has the spare bed.
   * Validated to belong to this user on creation.
   */
  @Prop({ type: Types.ObjectId, ref: 'Property', index: true, sparse: true })
  propertyId?: Types.ObjectId;

  // ── Location & campus ─────────────────────────────────────────────────────

  /** City the student wants to live in — drives the matching pool filter */
  @Prop({ required: true, trim: true, index: true })
  campusCity: string;

  @Prop({ trim: true })
  preferredNeighborhood?: string;

  // ── Budget ────────────────────────────────────────────────────────────────

  /** Maximum budget per person per month in XAF */
  @Prop({ required: true, min: 0 })
  budgetPerPersonMax: number;

  /** Minimum budget per person (helps filter out options that are too cheap/unsafe) */
  @Prop({ default: 0, min: 0 })
  budgetPerPersonMin: number;

  // ── Move-in ───────────────────────────────────────────────────────────────

  @Prop({ required: true })
  moveInDate: Date;

  /** How flexible the move-in date is, in days (0 = exact date required) */
  @Prop({ default: 14, min: 0 })
  moveInFlexibilityDays: number;

  // ── Lifestyle preferences ─────────────────────────────────────────────────

  @Prop({ type: String, enum: Object.values(SleepSchedule), required: true })
  sleepSchedule: SleepSchedule;

  @Prop({ type: String, enum: Object.values(CleanlinessLevel), required: true })
  cleanlinessLevel: CleanlinessLevel;

  @Prop({ type: String, enum: Object.values(SocialHabit), required: true })
  socialHabit: SocialHabit;

  @Prop({ type: String, enum: Object.values(StudyHabit), required: true })
  studyHabit: StudyHabit;

  /** Whether the student smokes */
  @Prop({ default: false })
  isSmoker: boolean;

  /** Whether they are comfortable with a smoking roommate */
  @Prop({ default: false })
  acceptsSmoker: boolean;

  /** Whether they have a pet */
  @Prop({ default: false })
  hasPet: boolean;

  /** Whether they are comfortable with a roommate who has a pet */
  @Prop({ default: false })
  acceptsPet: boolean;

  // ── Gender preference ─────────────────────────────────────────────────────

  /**
   * Gender preference for their roommate.
   * 'any' is always the default — no restriction.
   */
  @Prop({
    type: String,
    enum: ['male', 'female', 'any'],
    default: 'any',
  })
  preferredRoommateGender: 'male' | 'female' | 'any';

  // ── Bio ───────────────────────────────────────────────────────────────────

  /** Short self-description shown on the roommate card — max 300 chars */
  @Prop({ trim: true, maxlength: 300 })
  bio?: string;

  // ── Visibility ────────────────────────────────────────────────────────────

  /**
   * Controls whether this profile appears in search results.
   * Students can pause their profile without deleting it.
   */
  @Prop({ default: true, index: true })
  isActive: boolean;

  // ── Timestamps ────────────────────────────────────────────────────────────

  createdAt: Date;
  updatedAt: Date;
}

export const RoommateProfileSchema = SchemaFactory.createForClass(RoommateProfile);

// Compound indexes for matching queries
RoommateProfileSchema.index({ campusCity: 1, mode: 1, isActive: 1 });
RoommateProfileSchema.index({ campusCity: 1, budgetPerPersonMax: 1, isActive: 1 });
RoommateProfileSchema.index({ campusCity: 1, moveInDate: 1, isActive: 1 });
RoommateProfileSchema.index({ campusCity: 1, sleepSchedule: 1, cleanlinessLevel: 1, isActive: 1 });