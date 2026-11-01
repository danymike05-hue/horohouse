// schemas/call.schema.ts - FIXED VERSION
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CallDocument = Call & Document;

export enum CallType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum CallStatus {
  INITIATING = 'initiating',
  RINGING = 'ringing',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ENDED = 'ended',
  DECLINED = 'declined',
  MISSED = 'missed',
  FAILED = 'failed',
  CANCELLED = 'cancelled', 
}

export enum CallEndReason {
  COMPLETED = 'completed',
  DECLINED = 'declined',
  MISSED = 'missed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  BUSY = 'busy',
  NO_ANSWER = 'no_answer',
}

export interface CallParticipant {
  userId: Types.ObjectId;
  joinedAt?: Date;
  leftAt?: Date;
  status: 'joining' | 'connected' | 'disconnected';
}

@Schema({ timestamps: true })
export class Call {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true, index: true })
  conversationId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  initiatorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recipientId: Types.ObjectId;

  @Prop({ type: String, enum: CallType, required: true })
  type: CallType;

  @Prop({ type: String, enum: CallStatus, default: CallStatus.INITIATING })
  status: CallStatus;

  @Prop({ type: [Object], default: [] })
  participants: CallParticipant[];

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  endedAt?: Date;

  @Prop({ type: Number, default: 0 })
  duration: number; // in seconds

  @Prop({ type: String, enum: CallEndReason })
  endReason?: CallEndReason;

  @Prop({ type: Object })
  quality?: {
    audioQuality: number; // 0-5 rating
    videoQuality: number; // 0-5 rating
    networkIssues: number; // count of network issues
  };

  @Prop({ type: Object })
  metadata?: {
    iceServers?: any[];
    sdp?: any;
    candidates?: any[];
  };

  createdAt: Date;
  updatedAt: Date;
}

export const CallSchema = SchemaFactory.createForClass(Call);

// Indexes
CallSchema.index({ conversationId: 1, createdAt: -1 });
CallSchema.index({ initiatorId: 1, status: 1 });
CallSchema.index({ recipientId: 1, status: 1 });
CallSchema.index({ status: 1, createdAt: -1 });