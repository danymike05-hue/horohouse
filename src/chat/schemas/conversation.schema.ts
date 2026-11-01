import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

export interface ParticipantInfo {
  userId: Types.ObjectId;
  unreadCount: number;
  lastReadAt?: Date;
  mutedUntil?: Date;
  joinedAt: Date;
}

export interface LastMessage {
  content: string;
  senderId: Types.ObjectId;
  createdAt: Date;
  type: string;
}

@Schema({ timestamps: true })
export class Conversation {
  _id: Types.ObjectId;

  @Prop({ 
    type: [{ 
      userId: { type: Types.ObjectId, ref: 'User', required: true },
      unreadCount: { type: Number, default: 0 },
      lastReadAt: { type: Date },
      mutedUntil: { type: Date },
      joinedAt: { type: Date, default: Date.now },
    }],
    required: true,
  })
  participants: ParticipantInfo[];

  @Prop({ type: Types.ObjectId, ref: 'Property' })
  propertyId?: Types.ObjectId;

  @Prop({ type: Object })
  lastMessage?: LastMessage;

  @Prop({ default: 0 })
  messagesCount: number;

  @Prop({ type: Map, of: Boolean, default: {} })
  typingUsers: Map<string, boolean>;

  @Prop({ type: Map, of: String, default: {} })
  onlineStatus: Map<string, string>; // userId -> 'online' | 'offline' | 'away'

  @Prop({ default: false })
  isArchived: boolean;

  @Prop({ type: Date })
  archivedAt?: Date;

  @Prop({ type: [Types.ObjectId], default: [] })
  archivedBy: Types.ObjectId[];

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  blockedBy?: Types.ObjectId;

  @Prop({ type: Date })
  blockedAt?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  createdAt: Date;
  updatedAt: Date;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Indexes
ConversationSchema.index({ 'participants.userId': 1 });
ConversationSchema.index({ propertyId: 1 });
ConversationSchema.index({ 'lastMessage.createdAt': -1 });
ConversationSchema.index({ isArchived: 1, 'lastMessage.createdAt': -1 });

// Compound index for finding conversations between two users
ConversationSchema.index({ 
  'participants.userId': 1, 
  propertyId: 1 
});