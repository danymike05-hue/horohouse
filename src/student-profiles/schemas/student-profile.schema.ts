import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { StudentVerificationStatus } from '../../users/schemas/user.schema';

export type StudentProfileDocument = StudentProfile & Document;

/**
 * Standalone StudentProfile collection.
 *
 * The User.studentProfile subdocument holds the minimal identity fields
 * (university, verification status, campusCity). This collection holds the
 * richer, mutable profile data that powers roommate matching, ambassador
 * tracking, and the admin verification queue — without bloating the User doc.
 *
 * Relationship: one-to-one with User (_id === userId).
 */
@Schema({ timestamps: true })
export class StudentProfile {
  /** References the User document. Acts as the natural PK for lookups. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: Types.ObjectId;

  // ── University identity ───────────────────────────────────────────────────

  @Prop({ required: true, trim: true })
  universityName: string;

  @Prop({ trim: true })
  faculty?: string;

  /** e.g. "L1", "L2", "L3", "Master 1", "Master 2", "PhD" */
  @Prop({ trim: true })
  studyLevel?: string;

  @Prop()
  enrollmentYear?: number;

  // ── Verification ──────────────────────────────────────────────────────────

  /** Cloudinary secure URL of the uploaded student ID photo */
  @Prop()
  studentIdUrl?: string;

  /** Cloudinary public_id — needed for deletion on re-upload or rejection */
  @Prop()
  studentIdPublicId?: string;

  @Prop({
    type: String,
    enum: Object.values(StudentVerificationStatus),
    default: StudentVerificationStatus.UNVERIFIED,
    index: true,
  })
  verificationStatus: StudentVerificationStatus;

  @Prop()
  verificationSubmittedAt?: Date;

  @Prop()
  verificationReviewedAt?: Date;

  /** Shown to the student when their ID is rejected */
  @Prop()
  verificationRejectionReason?: string;

  /** Admin who reviewed the ID — ObjectId reference to User (admin) */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  verificationReviewedBy?: Types.ObjectId;

  // ── Campus location ───────────────────────────────────────────────────────

  @Prop({ required: true, trim: true, index: true })
  campusCity: string;

  @Prop({ required: true, trim: true })
  campusName: string;

  /** Latitude of the nearest campus gate — used for commute calculations */
  @Prop()
  campusLatitude?: number;

  @Prop()
  campusLongitude?: number;

  // ── Roommate matching preferences ─────────────────────────────────────────

  /**
   * Whether the student is actively looking for a roommate or a room.
   * Drives visibility in the roommate pool.
   */
  @Prop({ default: false, index: true })
  isSeekingRoommate: boolean;

  /**
   * "have_room" — student has a spare bed and is looking for a co-tenant.
   * "need_room"  — student needs a property and wants to co-lease.
   */
  @Prop({
    type: String,
    enum: ['have_room', 'need_room'],
    default: null,
  })
  roommateMode?: 'have_room' | 'need_room' | null;

  /** Links to their active RoommateProfile document */
  @Prop({ type: Types.ObjectId, ref: 'RoommateProfile', index: true, sparse: true })
  roommateProfileId?: Types.ObjectId;

  // ── Ambassador programme ──────────────────────────────────────────────────

  @Prop({ default: false })
  isAmbassador: boolean;

  /** Unique referral code — e.g. "UB-PAUL-2024" */
  @Prop({ unique: true, sparse: true, uppercase: true, trim: true })
  ambassadorCode?: string;

  /** Cumulative commissions earned in XAF */
  @Prop({ default: 0, min: 0 })
  ambassadorEarnings: number;

  /** Number of successful referrals (student signed a lease via this code) */
  @Prop({ default: 0 })
  referralCount: number;

  /** Number of landlords onboarded via this ambassador */
  @Prop({ default: 0 })
  landlordReferralCount: number;

  // ── Timestamps ────────────────────────────────────────────────────────────

  createdAt: Date;
  updatedAt: Date;
}

export const StudentProfileSchema = SchemaFactory.createForClass(StudentProfile);

// Compound indexes
StudentProfileSchema.index({ campusCity: 1, verificationStatus: 1 });
StudentProfileSchema.index({ campusCity: 1, isSeekingRoommate: 1 });
StudentProfileSchema.index({ isAmbassador: 1, campusCity: 1 });