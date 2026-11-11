import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { MatchStatus } from './roommate-profile.schema';

export type RoommateMatchDocument = RoommateMatch & Document;

/**
 * Records a directional interest expression between two roommate profiles.
 *
 * Flow:
 *   1. Student A likes Student B  → creates a PENDING match (initiatorId = A, receiverId = B)
 *   2. Student B likes A back     → status flips to MATCHED, chatRoomId is created
 *   3. Student B ignores/rejects  → status becomes REJECTED or EXPIRED after 7 days
 *
 * A mutual match unlocks the in-app chat between the two students.
 */
@Schema({ timestamps: true })
export class RoommateMatch {
  /** The student who expressed interest first */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  initiatorId: Types.ObjectId;

  /** The student who received the interest */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  receiverId: Types.ObjectId;

  /** Snapshot of the initiator's RoommateProfile at match time */
  @Prop({ type: Types.ObjectId, ref: 'RoommateProfile', required: true })
  initiatorProfileId: Types.ObjectId;

  /** Snapshot of the receiver's RoommateProfile at match time */
  @Prop({ type: Types.ObjectId, ref: 'RoommateProfile', required: true })
  receiverProfileId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(MatchStatus),
    default: MatchStatus.PENDING,
    index: true,
  })
  status: MatchStatus;

  /**
   * Compatibility score computed at match time (0–100).
   * Higher = more lifestyle factors in common.
   * Stored so results can be sorted without recomputing.
   */
  @Prop({ default: 0, min: 0, max: 100 })
  compatibilityScore: number;

  /**
   * Chat room ID created by ChatModule when status flips to MATCHED.
   * Null until both sides accept.
   */
  @Prop({ type: Types.ObjectId, ref: 'ChatRoom', sparse: true })
  chatRoomId?: Types.ObjectId;

  /** When the receiver accepted (status → MATCHED) */
  @Prop()
  matchedAt?: Date;

  /** When the match expires if no response (set 7 days after creation) */
  @Prop({ index: true })
  expiresAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const RoommateMatchSchema = SchemaFactory.createForClass(RoommateMatch);

// Prevent duplicate pending matches between the same pair
RoommateMatchSchema.index(
  { initiatorId: 1, receiverId: 1 },
  { unique: true, partialFilterExpression: { status: MatchStatus.PENDING } },
);

// Fast lookup: "show me all my pending/matched connections"
RoommateMatchSchema.index({ receiverId: 1, status: 1, createdAt: -1 });
RoommateMatchSchema.index({ initiatorId: 1, status: 1, createdAt: -1 });

// Cron job index: find expired PENDING matches
RoommateMatchSchema.index({ status: 1, expiresAt: 1 });